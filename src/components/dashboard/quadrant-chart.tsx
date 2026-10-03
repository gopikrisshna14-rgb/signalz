"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { Account } from "@/lib/types";
import { BUCKET_LABELS } from "@/lib/types";

const COLOR = {
  call_today: "var(--chart-1)",
  net_new: "var(--chart-2)",
  other: "var(--muted)",
};

type Point = Account & { x: number; y: number; z: number };

function TooltipCard({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const a = payload[0]!.payload;
  return (
    <div className="max-w-64 rounded-lg border border-line bg-surface p-2.5 text-[12px] shadow-lg">
      <div className="font-semibold">{a.name}</div>
      {a.division_label && <div className="text-muted">{a.division_label}</div>}
      {a.top_reason && <div className="mt-1">{a.top_reason}</div>}
      <div className="tabular mt-1 text-muted">
        Cluster {a.cluster_score} · Fit {a.fit_score} · {BUCKET_LABELS[a.bucket]}
      </div>
    </div>
  );
}

export function QuadrantChart({ accounts, onSelect }: { accounts: Account[]; onSelect: (id: string) => void }) {
  const toPoints = (list: Account[]): Point[] =>
    list.map((a) => ({ ...a, x: a.cluster_score, y: a.fit_score, z: Math.max(1, a.open_roles ?? 1) }));
  const callToday = toPoints(accounts.filter((a) => a.bucket === "call_today"));
  const netNew = toPoints(accounts.filter((a) => a.bucket === "net_new"));
  const rest = toPoints(accounts.filter((a) => a.bucket !== "call_today" && a.bucket !== "net_new"));
  const click = (p: unknown) => {
    const id = (p as { payload?: Point })?.payload?.id ?? (p as Point)?.id;
    if (id) onSelect(id);
  };

  return (
    <div className="relative h-[280px] w-full">
      <span className="pointer-events-none absolute top-1 right-3 z-10 text-[12px] font-medium text-accent">Call today ↗</span>
      <span className="pointer-events-none absolute top-1 left-12 z-10 text-[12px] text-muted">↖ Right fit, not ready yet</span>
      <span className="pointer-events-none absolute right-3 bottom-9 z-10 text-[12px] text-muted">Qualify fast ↘</span>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 12, bottom: 16, left: -8 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            stroke="var(--border)"
            label={{ value: "Hiring intent (cluster score)", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            stroke="var(--border)"
          />
          <ZAxis type="number" dataKey="z" range={[60, 360]} />
          <ReferenceLine x={60} stroke="var(--muted)" strokeDasharray="4 4" />
          <ReferenceLine y={60} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip content={<TooltipCard />} cursor={false} />
          <Scatter data={rest} fill={COLOR.other} fillOpacity={0.55} stroke="var(--surface)" strokeWidth={2} onClick={click} className="cursor-pointer" />
          <Scatter data={netNew} fill={COLOR.net_new} fillOpacity={0.9} stroke="var(--surface)" strokeWidth={2} onClick={click} className="cursor-pointer" />
          <Scatter data={callToday} fill={COLOR.call_today} fillOpacity={0.95} stroke="var(--surface)" strokeWidth={2} onClick={click} className="cursor-pointer" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
