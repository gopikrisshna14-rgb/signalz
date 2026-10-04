"use client";

import { useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { TierPill } from "@/components/ui/pills";
import type { AccountRow } from "@/lib/accounts";
import { BUCKET_LABEL, type Bucket } from "@/lib/types";

/** Three validated categorical hues for the main buckets; everything else is neutral. */
const SERIES: { bucket: Bucket | "rest"; label: string; color: string }[] = [
  { bucket: "call_today", label: BUCKET_LABEL.call_today, color: "var(--chart-1)" },
  { bucket: "high_intent", label: BUCKET_LABEL.high_intent, color: "var(--chart-2)" },
  { bucket: "net_new", label: BUCKET_LABEL.net_new, color: "var(--chart-3)" },
  { bucket: "rest", label: "Other buckets", color: "var(--muted)" },
];

const seriesOf = (b: Bucket) => (b === "call_today" || b === "high_intent" || b === "net_new" ? b : "rest");

function HoverCard({ active, payload }: { active?: boolean; payload?: { payload: AccountRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="w-64 rounded-xl border border-line bg-surface p-3 text-[13px] shadow-lg shadow-black/5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold">{r.name}</span>
        <TierPill tier={r.tier} />
      </div>
      <div className="mt-1 text-[12px] text-muted">{r.division ?? "No active cluster"}</div>
      <dl className="tabular mt-2 grid grid-cols-3 gap-1 text-[12px]">
        <div>
          <dt className="text-muted">Cluster</dt>
          <dd className="font-semibold">{r.cluster}</dd>
        </div>
        <div>
          <dt className="text-muted">Fit</dt>
          <dd className="font-semibold">{r.fit}</dd>
        </div>
        <div>
          <dt className="text-muted">Open roles</dt>
          <dd className="font-semibold">{r.openRoles}</dd>
        </div>
      </dl>
      {r.topReason ? <p className="mt-2 text-[12px]">{r.topReason}</p> : null}
      <p className="mt-1 text-[11px] text-muted">Click to open</p>
    </div>
  );
}

export function Quadrant({ rows, onOpen }: { rows: AccountRow[]; onOpen: (id: string) => void }) {
  const [asTable, setAsTable] = useState(false);
  const data = rows.map((r) => ({ ...r, size: Math.max(1, r.openRoles) }));
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Hiring intent vs fit"
        description="x = hiring cluster index, y = ICP fit, size = open roles"
        action={
          <button className="text-[12px] font-medium text-accent hover:underline" onClick={() => setAsTable((v) => !v)}>
            {asTable ? "View as chart" : "View as table"}
          </button>
        }
      />
      {asTable ? (
        <div className="max-h-[300px] overflow-auto px-4 pb-4">
          <table className="mt-3 w-full text-[13px]">
            <caption className="sr-only">Accounts by hiring intent and fit</caption>
            <thead className="text-left text-[12px] text-muted">
              <tr>
                <th className="py-1 font-medium">Company</th>
                <th className="py-1 font-medium">Bucket</th>
                <th className="py-1 text-right font-medium">Cluster</th>
                <th className="py-1 text-right font-medium">Fit</th>
                <th className="py-1 text-right font-medium">Roles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5">
                    <button className="hover:underline" onClick={() => onOpen(r.id)}>
                      {r.name}
                    </button>
                  </td>
                  <td className="py-1.5 text-muted">{BUCKET_LABEL[r.bucket]}</td>
                  <td className="tabular py-1.5 text-right">{r.cluster}</td>
                  <td className="tabular py-1.5 text-right">{r.fit}</td>
                  <td className="tabular py-1.5 text-right">{r.openRoles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative px-2 pt-2 pb-3">
          <div className="pointer-events-none absolute inset-x-14 top-3 flex justify-between text-[11px] font-medium text-muted" aria-hidden>
            <span>Right fit, not ready yet ↖</span>
            <span className="text-accent">Call today ↗</span>
          </div>
          <div className="pointer-events-none absolute right-8 bottom-[72px] text-[11px] font-medium text-muted" aria-hidden>
            Qualify fast ↘
          </div>
          <div className="h-[280px]" role="img" aria-label={`Scatter chart of ${rows.length} accounts by hiring intent and fit. Use View as table for the data.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis type="number" dataKey="cluster" domain={[0, 100]} ticks={[0, 30, 60, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" label={{ value: "Hiring intent", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted)" }} />
                <YAxis type="number" dataKey="fit" domain={[0, 100]} ticks={[0, 30, 60, 100]} width={36} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
                <ZAxis type="number" dataKey="size" range={[50, 360]} />
                <ReferenceLine x={60} stroke="var(--muted)" strokeDasharray="4 4" />
                <ReferenceLine y={60} stroke="var(--muted)" strokeDasharray="4 4" />
                <Tooltip content={<HoverCard />} cursor={false} />
                {SERIES.map((s) => (
                  <Scatter
                    key={s.bucket}
                    name={s.label}
                    data={data.filter((d) => seriesOf(d.bucket) === s.bucket)}
                    fill={s.color}
                    fillOpacity={0.85}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    cursor="pointer"
                    onClick={(p) => onOpen((p as unknown as { payload: AccountRow }).payload.id)}
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-[12px] text-muted" aria-label="Legend">
            {SERIES.map((s) => (
              <li key={s.bucket} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
