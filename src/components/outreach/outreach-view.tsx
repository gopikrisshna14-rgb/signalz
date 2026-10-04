"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChartCard, DataTable, Heatmap } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { funnelByAngle, leaderboard, replyHeatmap } from "@/lib/analytics";
import { relativeTime } from "@/lib/format";
import { ANGLE_LABEL, OUTREACH_LABEL, type Company, type OutreachEvent, type Template } from "@/lib/types";
import { TemplatesEditor } from "./templates-editor";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

export function OutreachView({ events, templates, sample, timezone }: { events: OutreachEvent[]; templates: Template[]; sample: Company | null; timezone: string | null }) {
  const [tz, setTz] = useState(timezone ?? "UTC");
  useEffect(() => {
    if (!timezone) setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [timezone]);
  const funnel = useMemo(() => funnelByAngle(events), [events]);
  const heat = useMemo(() => replyHeatmap(events, tz), [events, tz]);
  const board = useMemo(() => leaderboard(events), [events]);
  const max = Math.max(1, ...funnel.map((f) => f.sent));
  const hours = Array.from({ length: 24 }, (_, h) => `${h}`);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-semibold">Outreach</h1>
        <p className="mt-0.5 text-[13px] text-muted">What your team logged after sending on LinkedIn. Signalz never sends messages itself.</p>
      </header>

      {events.length === 0 ? (
        <EmptyState icon={<Send size={18} />} title="No outreach logged yet" text="Open an account, copy the opener, send it on LinkedIn and log the step with one click." action={<Link href="/" className="text-[13px] text-accent hover:underline">Go to Today</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Funnel by angle"
            description="Threads that reached each stage (sent → accepted → replied → meeting)"
            chart={
              <div className="space-y-4">
                {funnel.map((f) => (
                  <div key={f.angle}>
                    <div className="mb-1 flex items-baseline justify-between text-[13px]">
                      <span className="font-medium">{f.label}</span>
                      <span className="tabular text-[12px] text-muted">
                        reply rate {pct(f.replied, f.sent)} · meetings {pct(f.meeting, f.sent)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          ["Sent", f.sent],
                          ["Accepted", f.accepted],
                          ["Replied", f.replied],
                          ["Meeting", f.meeting],
                        ] as const
                      ).map(([l, v]) => (
                        <div key={l}>
                          <div className="flex h-10 items-end overflow-hidden rounded-[4px] bg-surface-2" title={`${l}: ${v}`}>
                            <div className="w-full rounded-t-[4px] bg-[var(--chart-1)]" style={{ height: `${Math.max(v ? 6 : 0, (v / max) * 100)}%` }} />
                          </div>
                          <div className="tabular mt-1 text-[11px] text-muted">
                            {l} <span className="font-semibold text-fg">{v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            }
            table={<DataTable caption="Funnel by angle" head={["Angle", "Sent", "Accepted", "Replied", "Meeting", "Reply rate"]} rows={funnel.map((f) => [f.label, f.sent, f.accepted, f.replied, f.meeting, pct(f.replied, f.sent)])} />}
          />
          <ChartCard
            title="When replies come in"
            description={`Replies by weekday × hour (${tz})`}
            chart={<Heatmap compact rows={DAYS} cols={hours} cells={heat} unit="replies" label="Heatmap of replies by weekday and hour" />}
            table={<DataTable caption="Replies by weekday and hour" head={["Day", ...hours]} rows={heat.map((r, i) => [DAYS[i], ...r])} />}
          />
          <Card className="lg:col-span-2">
            <CardHeader title="Leaderboard" description="Per SDR, by threads" />
            <div className="overflow-x-auto p-4 pt-3">
              <table className="w-full min-w-[560px] text-[13px]">
                <caption className="sr-only">Outreach leaderboard</caption>
                <thead className="text-left text-[12px] text-muted">
                  <tr>
                    <th scope="col" className="py-1 font-medium">SDR</th>
                    {["Sent", "Accepted", "Replied", "Meetings", "Reply rate", "Steps logged"].map((h) => (
                      <th key={h} scope="col" className="py-1 text-right font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board.map((r, i) => (
                    <tr key={r.userId} className="border-t border-line">
                      <td className="py-2 font-medium">
                        <span className="tabular mr-2 text-muted">{i + 1}</span>
                        {r.name}
                      </td>
                      <td className="tabular text-right">{r.sent}</td>
                      <td className="tabular text-right">{r.accepted}</td>
                      <td className="tabular text-right">{r.replied}</td>
                      <td className="tabular text-right font-semibold">{r.meetings}</td>
                      <td className="tabular text-right">{r.replyRate === null ? "—" : `${Math.round(r.replyRate * 100)} %`}</td>
                      <td className="tabular text-right text-muted">{r.steps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Recent activity" />
            <ul className="divide-y divide-line p-2">
              {events.slice(0, 12).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 px-2 py-2 text-[13px]">
                  <span className="font-medium">{e.userName}</span>
                  <span className="text-muted">logged</span>
                  <span className="font-medium">{OUTREACH_LABEL[e.type]}</span>
                  <span className="text-muted">·</span>
                  {e.companyId.startsWith("past_") ? <span>{e.companyName}</span> : <Link href={`/accounts/${e.companyId}`} className="hover:underline">{e.companyName}</Link>}
                  {e.angle ? <span className="text-muted">· {ANGLE_LABEL[e.angle]}</span> : null}
                  <span className="ml-auto text-[12px] text-muted">{relativeTime(e.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <TemplatesEditor templates={templates} sample={sample} />
    </div>
  );
}
