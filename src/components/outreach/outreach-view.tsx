"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, CheckCheck, Info, MessageSquareReply, Send, Trophy } from "lucide-react";
import { cn, relativeTime } from "@/lib/format";
import { ANGLE_LABELS, sampleOutreach, weekLabel, type OutreachData } from "@/lib/sample-data";
import { Avatar, Card, Pill } from "@/components/ui";
import { BarList, ChartCard, ChartTooltip, DataSourceSwitch, Heatmap, StatTile } from "@/components/charts";

const EVENT_LABEL: Record<string, string> = {
  connection_sent: "sent a connection request to",
  connection_accepted: "got accepted by",
  message_sent: "messaged",
  inmail_sent: "sent an InMail to",
  email_sent: "e-mailed",
  replied: "got a reply from",
  positive_reply: "got a positive reply from",
  meeting_booked: "booked a meeting with",
  not_interested: "heard 'not interested' from",
  link_clicked: "saw a link click from",
};

const EVENT_TONE: Record<string, string> = {
  meeting_booked: "bg-ok/15 text-ok",
  replied: "bg-accent-soft text-accent",
  positive_reply: "bg-accent-soft text-accent",
  not_interested: "bg-danger-bg text-danger-fg",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function OutreachView({
  live,
  templates,
}: {
  live: OutreachData;
  templates: { id: string; name: string; angle: string; body: string }[];
}) {
  const liveAvailable = live.byAngle.some((a) => a.sent > 0) || live.activity.length > 0;
  const [mode, setMode] = useState<"live" | "sample">(liveAvailable ? "live" : "sample");
  const data = useMemo(() => (mode === "live" ? live : sampleOutreach()), [mode, live]);

  const totals = data.byAngle.reduce(
    (t, a) => ({ sent: t.sent + a.sent, accepted: t.accepted + a.accepted, replies: t.replies + a.replies, meetings: t.meetings + a.meetings }),
    { sent: 0, accepted: 0, replies: 0, meetings: 0 },
  );
  const angles = [...data.byAngle].filter((a) => a.sent > 0).sort((a, b) => pct(b.replies, b.sent) - pct(a.replies, a.sent));
  const best = angles[0];

  // Reply-rate heatmap in the viewer's local time (set after mount so server and client markup match).
  const [offsetH, setOffsetH] = useState(0);
  useEffect(() => setOffsetH(-new Date().getTimezoneOffset() / 60), []);
  const cells = new Map<string, { sent: number; replied: number }>();
  for (const c of data.replyTimes) {
    let h = c.hour + (c.utc ? offsetH : 0);
    let d = c.weekday;
    if (h >= 24) (h -= 24), (d = (d % 7) + 1);
    if (h < 0) (h += 24), (d = ((d + 5) % 7) + 1);
    const k = `${d}|${Math.round(h)}`;
    const e = cells.get(k) ?? { sent: 0, replied: 0 };
    e.sent += c.sent;
    e.replied += c.replied;
    cells.set(k, e);
  }
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  let bestSlot: { d: number; h: number; rate: number } | null = null;
  for (const [k, v] of cells) {
    const [d, h] = k.split("|").map(Number) as [number, number];
    const rate = v.sent >= 3 ? v.replied / v.sent : 0;
    if (!bestSlot || rate > bestSlot.rate) bestSlot = { d, h, rate };
  }

  const funnel = [
    { key: "sent", label: "Sent", value: totals.sent },
    { key: "accepted", label: "Accepted", value: totals.accepted },
    { key: "replies", label: "Replied", value: totals.replies },
    { key: "meetings", label: "Meeting", value: totals.meetings },
  ];
  const leaders = [...data.byUser].sort((a, b) => b.meetings - a.meetings || b.replies - a.replies);
  const maxMeetings = Math.max(1, ...leaders.map((l) => l.meetings));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Outreach</h1>
          <p className="mt-0.5 text-[14px] text-muted">What works: angles, timing and who&apos;s booking meetings · last 90 days</p>
        </div>
        <DataSourceSwitch mode={mode} onChange={setMode} liveAvailable={liveAvailable} />
      </div>

      {mode === "sample" && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-accent-soft/60 px-3 py-2.5 text-[13px]">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <b>Sample data.</b> Log outreach on an account (Connection sent, Replied, Meeting booked…) and this page switches to your
            team&apos;s real numbers.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Messages sent" value={totals.sent} icon={<Send size={15} />} tone="accent" />
        <StatTile label="Acceptance rate" value={`${pct(totals.accepted, totals.sent)}%`} icon={<CheckCheck size={15} />} tone="accent" hint={`${totals.accepted} accepted`} />
        <StatTile label="Reply rate" value={`${pct(totals.replies, totals.sent)}%`} icon={<MessageSquareReply size={15} />} tone="accent" hint={`${totals.replies} replies`} />
        <StatTile label="Meetings booked" value={totals.meetings} icon={<CalendarCheck size={15} />} tone="hot" hint={`${pct(totals.meetings, totals.sent)}% of messages`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Funnel" subtitle="From first touch to meeting" table={{ head: ["Stage", "Count"], rows: funnel.map((f) => [f.label, f.value]) }}>
          <ol className="space-y-3">
            {funnel.map((f, i) => (
              <li key={f.key}>
                <div className="mb-1 flex items-baseline justify-between text-[13px]">
                  <span>{f.label}</span>
                  <span className="tabular">
                    <span className="font-semibold">{f.value}</span>
                    {i > 0 && <span className="ml-1.5 text-[12px] text-muted">{pct(f.value, funnel[i - 1]!.value)}%</span>}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct(f.value, totals.sent)}%`, minWidth: f.value ? 4 : 0 }} />
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard
          title="Reply rate by angle"
          subtitle={best ? `Best: ${ANGLE_LABELS[best.angle] ?? best.angle} (${pct(best.replies, best.sent)}%)` : "No messages yet"}
          table={{
            head: ["Angle", "Sent", "Replies", "Meetings", "Reply rate"],
            rows: angles.map((a) => [ANGLE_LABELS[a.angle] ?? a.angle, a.sent, a.replies, a.meetings, `${pct(a.replies, a.sent)}%`]),
          }}
        >
          <BarList
            items={angles.map((a) => ({
              key: a.angle,
              label: ANGLE_LABELS[a.angle] ?? a.angle,
              value: pct(a.replies, a.sent),
              hint: `${a.replies} replies from ${a.sent} messages · ${a.meetings} meetings`,
            }))}
            format={(v) => `${v}%`}
          />
        </ChartCard>

        <ChartCard
          title="Best time to send"
          subtitle={bestSlot && bestSlot.rate > 0 ? `${DAYS[bestSlot.d - 1]} around ${bestSlot.h}:00 · ${Math.round(bestSlot.rate * 100)}% reply` : "Reply rate by weekday and hour"}
        >
          <Heatmap
            rows={[1, 2, 3, 4, 5].map((d) => ({ key: String(d), label: DAYS[d - 1]! }))}
            cols={hours.map((h) => ({ key: String(h), label: h % 3 === 1 ? `${h}` : "" }))}
            minCell={14}
            value={(r, c) => {
              const v = cells.get(`${r}|${c}`);
              return v && v.sent ? Math.round((v.replied / v.sent) * 100) : null;
            }}
            tooltip={(r, c, v) => `${DAYS[Number(r) - 1]} ${c}:00 · ${v == null ? "no messages" : `${v}% reply rate`}`}
          />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Weekly activity"
          subtitle="Messages sent and replies per week"
          className="lg:col-span-2"
          table={{ head: ["Week", "Sent", "Replies"], rows: data.weekly.map((w) => [weekLabel(w.week), w.sent, w.replies]) }}
        >
          {data.weekly.length === 0 ? (
            <p className="text-[13px] text-muted">No activity yet.</p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip format={weekLabel} />} cursor={{ fill: "var(--surface-2)" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
                  <Bar dataKey="sent" name="Sent" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="replies" name="Replies" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Leaderboard" subtitle="Meetings booked · last 30 days" action={<Trophy size={15} className="text-warm-fg" />}>
          {leaders.length === 0 ? (
            <p className="text-[13px] text-muted">No outreach logged yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {leaders.slice(0, 6).map((u, i) => (
                <li key={u.user_id} className="flex items-center gap-2.5">
                  <span className="tabular w-4 text-[12px] font-semibold text-muted">{i + 1}</span>
                  <Avatar name={u.full_name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{u.full_name}</span>
                      <span className="tabular text-[13px] font-semibold">{u.meetings}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${(u.meetings / maxMeetings) * 100}%` }} />
                    </div>
                    <div className="tabular mt-0.5 text-[11px] text-muted">
                      {u.sent} sent · {pct(u.replies, u.sent)}% reply · {u.accounts_touched} accounts
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Recent activity" className="lg:col-span-2">
          {data.activity.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing logged yet. Open an account and use &quot;Log what you did&quot;.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.activity.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <Avatar name={e.user} size={26} />
                  <div className="min-w-0 flex-1 text-[13px]">
                    <span className="font-medium">{e.user.split(" ")[0]}</span>{" "}
                    <span className="text-muted">{EVENT_LABEL[e.event_type] ?? e.event_type.replace(/_/g, " ")}</span>{" "}
                    <span className="font-medium">{e.person || e.company}</span>
                    {e.person && <span className="text-muted"> · {e.company}</span>}
                  </div>
                  {e.angle && <Pill className={cn("hidden sm:inline-flex", EVENT_TONE[e.event_type])}>{ANGLE_LABELS[e.angle] ?? e.angle}</Pill>}
                  <span className="w-16 shrink-0 text-right text-[12px] text-muted">{relativeTime(e.occurred_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Templates" subtitle="Used to pre-fill openers on each account">
          {templates.length === 0 ? (
            <p className="text-[13px] text-muted">No templates yet. Loading demo data adds three.</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <Card className="bg-surface-2/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{t.name}</span>
                      <Pill>{ANGLE_LABELS[t.angle] ?? t.angle}</Pill>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[12px] text-muted">{t.body}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
