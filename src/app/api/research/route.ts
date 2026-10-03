import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeLinkedIn } from "@/lib/linkedin";
import { sendToN8n } from "@/lib/n8n";

export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.RESEARCH_LIMIT_PER_DAY ?? 50);
const Body = z.object({ urls: z.array(z.string().max(500)).min(1).max(25) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Paste between 1 and 25 URLs." }, { status: 400 });

  const valid = new Map<string, "person" | "company">();
  const invalid: string[] = [];
  for (const raw of parsed.data.urls) {
    if (!raw.trim()) continue;
    const n = normalizeLinkedIn(raw);
    if (n) valid.set(n.url, n.kind);
    else invalid.push(raw.trim());
  }
  if (valid.size === 0) {
    return NextResponse.json(
      { error: "no_valid_urls", message: "Use LinkedIn profile (/in/…) or company (/company/…) URLs.", invalid },
      { status: 400 },
    );
  }

  // Current workspace: the profile's default, else the first active membership.
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("default_org_id").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("org_id").eq("user_id", user.id).eq("status", "active"),
  ]);
  const orgIds = (memberships ?? []).map((m) => m.org_id as string);
  const orgId = orgIds.includes(profile?.default_org_id as string) ? (profile!.default_org_id as string) : orgIds[0];
  if (!orgId) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabase
    .from("research_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .gte("created_at", since);
  if ((count ?? 0) + valid.size > DAILY_LIMIT) {
    return NextResponse.json(
      { error: "rate_limited", message: `Daily limit reached (${DAILY_LIMIT} URLs per 24 h). ${Math.max(0, DAILY_LIMIT - (count ?? 0))} left.` },
      { status: 429 },
    );
  }

  const { data: rows, error } = await supabase
    .from("research_requests")
    .insert([...valid.keys()].map((url) => ({ org_id: orgId, linkedin_url: url })))
    .select("id, linkedin_url, kind");
  if (error || !rows) return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 });

  const results = await Promise.all(
    rows.map(async (r) => {
      const sent = await sendToN8n({ request_id: r.id, org_id: orgId, linkedin_url: r.linkedin_url, kind: r.kind });
      if (!sent.ok) await supabase.rpc("mark_research_dispatch", { p_request: r.id, p_ok: false, p_error: sent.error });
      return { id: r.id as string, ok: sent.ok, error: sent.ok ? null : sent.error };
    }),
  );

  return NextResponse.json({ requests: results, invalid });
}
