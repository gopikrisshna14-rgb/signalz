"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { Tooltip as Tip } from "@/components/ui/tooltip";

/** Card with a chart and a "View as table" switch. */
export function ChartCard({ title, description, chart, table, className }: { title: string; description?: string; chart: React.ReactNode; table: React.ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <button className="text-[12px] font-medium whitespace-nowrap text-accent hover:underline" onClick={() => setAsTable((v) => !v)}>
            {asTable ? "View as chart" : "View as table"}
          </button>
        }
      />
      <div className="p-4 pt-3">{asTable ? <div className="max-h-[360px] overflow-auto">{table}</div> : chart}</div>
    </Card>
  );
}

export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-left text-[12px] text-muted">
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={`py-1 font-medium ${i > 0 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-line">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 ${j > 0 ? "tabular text-right" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Sequential single-hue heatmap (light → dark accent). Every cell has a tooltip; zero cells stay neutral. */
export function Heatmap({ rows, cols, cells, unit, label, compact }: { rows: string[]; cols: string[]; cells: number[][]; unit: string; label: string; compact?: boolean }) {
  const max = Math.max(1, ...cells.flat());
  return (
    <div className="overflow-x-auto" role="img" aria-label={`${label}. Use View as table for the numbers.`}>
      <table className={`border-separate border-spacing-[2px] text-[11px] ${compact ? "w-full" : ""}`}>
        <thead>
          <tr>
            <th />
            {cols.map((c, i) => (
              <th key={i} scope="col" className="px-0 font-normal whitespace-nowrap text-muted">
                {compact && i % 3 !== 0 ? "" : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row" className="max-w-[200px] truncate pr-2 text-left font-normal whitespace-nowrap">
                {r}
              </th>
              {cols.map((c, j) => {
                const v = cells[i]?.[j] ?? 0;
                return (
                  <td key={j} className="p-0">
                    <Tip content={`${r} · ${c}: ${v} ${unit}`}>
                      <span
                        tabIndex={-1}
                        className={`tabular flex items-center justify-center rounded-[4px] border border-line ${compact ? "h-5 w-full min-w-[9px]" : "h-8 min-w-10"} ${v / max > 0.55 ? "text-accent-fg" : "text-fg"}`}
                        style={{ background: v ? `color-mix(in oklab, var(--accent) ${18 + (v / max) * 82}%, var(--surface))` : "var(--surface-2)" }}
                      >
                        {compact ? "" : v || ""}
                      </span>
                    </Tip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const axis = { fontSize: 11, fill: "var(--muted)" };

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md shadow-black/5">
      <div className="text-muted">{label}</div>
      <div className="tabular font-semibold">
        {payload[0].value} {unit}
      </div>
    </div>
  );
}

export function HBars({ data, x, y, unit, label }: { data: Record<string, string | number>[]; x: string; y: string; unit: string; label: string }) {
  return (
    <div style={{ height: Math.max(160, data.length * 34) }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tick={axis} stroke="var(--border)" allowDecimals={false} />
          <YAxis type="category" dataKey={y} tick={axis} stroke="var(--border)" width={120} />
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "var(--hover)" }} />
          <Bar dataKey={x} fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ data, x, y, unit, label }: { data: Record<string, string | number>[]; x: string; y: string; unit: string; label: string }) {
  return (
    <div className="h-[220px]" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={x} tick={axis} stroke="var(--border)" interval="preserveStartEnd" />
          <YAxis tick={axis} stroke="var(--border)" allowDecimals={false} width={30} />
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
          <Line dataKey={y} stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
