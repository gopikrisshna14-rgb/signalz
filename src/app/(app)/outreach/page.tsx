import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import type { OutreachData } from "@/lib/sample-data";
import { OutreachView } from "@/components/outreach/outreach-view";

export default async function OutreachPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const since = new Date(Date.now() - 84 * 86400000).toISOString();

  const [angles, users, replies, recent, weeklyRows, templates] = await Promise.all([
    supabase.from("v_outreach_by_angle").select("*").eq("org_id", ws.orgId),
    supabase.from("v_outreach_by_user").select("*").eq("org_id", ws.orgId),
    supabase.from("v_reply_time_heatmap").select("*").eq("org_id", ws.orgId),
    supabase
      .from("outreach_events")
      .select("id, event_type, angle, occurred_at, user_id, companies(name), people(full_name)")
      .eq("org_id", ws.orgId)
      .order("occurred_at", { ascending: false })
      .limit(12),
    supabase.from("outreach_events").select("event_type, occurred_at").eq("org_id", ws.orgId).gte("occurred_at", since),
    supabase.from("message_templates").select("id, name, angle, body").eq("org_id", ws.orgId).eq("archived", false),
  ]);

  const userNames = new Map((users.data ?? []).map((u) => [u.user_id as string, (u.full_name as string) ?? "Teammate"]));
  const SENT = ["connection_sent", "message_sent", "inmail_sent", "email_sent"];
  const weeks = new Map<string, { sent: number; replies: number }>();
  for (const e of weeklyRows.data ?? []) {
    const d = new Date(e.occurred_at as string);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    const w = weeks.get(k) ?? { sent: 0, replies: 0 };
    if (SENT.includes(e.event_type as string)) w.sent += 1;
    if (["replied", "positive_reply"].includes(e.event_type as string)) w.replies += 1;
    weeks.set(k, w);
  }

  const live: OutreachData = {
    byAngle: (angles.data ?? []).map((a) => ({
      angle: a.angle as string,
      sent: Number(a.sent),
      accepted: Number(a.accepted),
      replies: Number(a.replies),
      meetings: Number(a.meetings),
    })),
    byUser: (users.data ?? []).map((u) => ({
      user_id: u.user_id as string,
      full_name: (u.full_name as string) ?? "Teammate",
      sent: Number(u.sent),
      replies: Number(u.replies),
      meetings: Number(u.meetings),
      accounts_touched: Number(u.accounts_touched),
    })),
    replyTimes: (replies.data ?? []).map((r) => ({
      weekday: Number(r.weekday),
      hour: Number(r.hour),
      sent: Number(r.sent),
      replied: Number(r.replied),
      utc: true,
    })),
    activity: ((recent.data ?? []) as unknown as {
      id: string;
      event_type: string;
      angle: string | null;
      occurred_at: string;
      user_id: string;
      companies: { name: string } | null;
      people: { full_name: string | null } | null;
    }[]).map((e) => ({
      id: e.id,
      company: e.companies?.name ?? "—",
      person: e.people?.full_name ?? "",
      event_type: e.event_type,
      angle: e.angle,
      user: userNames.get(e.user_id) ?? "Teammate",
      occurred_at: e.occurred_at,
    })),
    weekly: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, ...v })),
  };

  return (
    <OutreachView
      live={live}
      templates={(templates.data ?? []) as { id: string; name: string; angle: string; body: string }[]}
    />
  );
}
