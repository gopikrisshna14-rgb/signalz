import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chat, extractJson, FeatherlessError, hasFeatherless } from "@/lib/featherless";

export const maxDuration = 60;

const Body = z.object({
  company_id: z.string().uuid(),
  angle: z.enum(["new_leader_90_days", "sdr_team_buildout", "crm_displacement", "new_region", "revops_hire", "funding", "custom"]),
});

const ANGLE_BRIEF: Record<string, string> = {
  new_leader_90_days: "The sales leader is new in the role: speak to what new leaders fix in their first 90 days.",
  sdr_team_buildout: "They are hiring several SDRs/AEs at once: speak to onboarding and scaling a new team.",
  crm_displacement: "Their job ads name a CRM: ask how the new reps will work in it day to day.",
  new_region: "They are expanding into a new region: speak to standing up a new team there.",
  revops_hire: "They are hiring RevOps: the person who picks tools is joining.",
  funding: "They raised money recently: speak to growing the team with the new budget.",
  custom: "Pick the most relevant reason from the facts.",
};

type Opener = { connection_note: string; message: string; email_subject: string; email_body: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (!hasFeatherless()) {
    return NextResponse.json(
      { error: "ai_not_configured", message: "Add FEATHERLESS_API_KEY in Vercel to write openers with AI." },
      { status: 503 },
    );
  }

  // Read through the user's session: RLS guarantees they only see their own workspace.
  const { company_id, angle } = parsed.data;
  const [{ data: account }, { data: person }, { data: sender }] = await Promise.all([
    supabase.from("v_accounts").select("*").eq("id", company_id).maybeSingle(),
    supabase
      .from("people")
      .select("full_name, current_title, started_current_role_at, prior_tools, recent_posts, country, languages")
      .eq("company_id", company_id)
      .order("is_decision_maker", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const german = ["DE", "AT", "CH"].includes(person?.country ?? account.hq_country ?? "");
  const facts = {
    company: account.name,
    industry: account.industry,
    employees: account.employee_count,
    division: account.division_label,
    open_roles: account.open_roles,
    why_now: account.reasons,
    current_crm: account.current_crm,
    contact: person
      ? {
          name: person.full_name,
          title: person.current_title,
          started_role: person.started_current_role_at,
          tools_used_before: person.prior_tools,
          recent_posts: (person.recent_posts as { text?: string }[] | null)?.slice(0, 3).map((p) => p.text),
        }
      : null,
    sender: sender?.full_name ?? "the SDR",
  };

  try {
    const answer = await chat([
      {
        role: "system",
        content:
          "You write first outreach messages for B2B SDRs. Plain, specific, one question, no flattery, no fake familiarity, " +
          "no emojis, no made-up facts: use only the facts given. Answer with JSON only: " +
          '{"connection_note": string (max 300 characters), "message": string (max 700 characters), ' +
          '"email_subject": string (max 70 characters), "email_body": string (max 900 characters)}.',
      },
      {
        role: "user",
        content:
          `Angle: ${ANGLE_BRIEF[angle]}\n` +
          `Language: ${german ? "German (informal business 'Sie'), unless the contact's facts suggest English" : "English"}.\n` +
          `Facts:\n${JSON.stringify(facts, null, 2)}`,
      },
    ]);
    const json = extractJson<Opener>(answer);
    const opener: Opener = json ?? { connection_note: answer.slice(0, 300), message: answer, email_subject: "", email_body: "" };
    opener.connection_note = (opener.connection_note ?? "").slice(0, 300);
    return NextResponse.json(opener);
  } catch (e) {
    const status = e instanceof FeatherlessError ? e.status : 502;
    return NextResponse.json({ error: "ai_failed", message: (e as Error).message }, { status });
  }
}
