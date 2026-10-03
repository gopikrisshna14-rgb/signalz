"use client";

import * as React from "react";
import { useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/format";
import { Card } from "@/components/ui";

/** Card with a title, an optional subtitle and a "View as table" fallback. */
export function ChartCard({
  title,
  subtitle,
  action,
  table,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  className?: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <button
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              title={asTable ? "View as chart" : "View as table"}
              aria-label={asTable ? "View as chart" : "View as table"}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg",
                asTable && "bg-surface-2 text-fg",
              )}
            >
              <Table2 size={14} />
            </button>
          )}
        </div>
      </div>
      {asTable && table ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="text-muted">
              <tr>
                {table.head.map((h) => (
                  <th key={h} className="py-1 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="py-1 pr-3">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </Card>
  );
}

/** Horizontal bars, one series: label left, thin bar, value right. */
export function BarList({
  items,
  format = (v) => String(v),
  color = "var(--chart-1)",
  onSelect,
  activeKey,
}: {
  items: { key: string; label: React.ReactNode; value: number; hint?: string }[];
  format?: (v: number) => string;
  color?: string;
  onSelect?: (key: string) => void;
  activeKey?: string | null;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const Inner = (
          <>
            <span className="w-[42%] shrink-0 truncate text-left text-[13px]">{it.label}</span>
            <span className="relative h-2 flex-1 rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                style={{ width: `${(it.value / max) * 100}%`, background: color, minWidth: it.value > 0 ? 4 : 0 }}
              />
            </span>
            <span className="tabular w-12 shrink-0 text-right text-[13px] font-medium">{format(it.value)}</span>
          </>
        );
        return (
          <li key={it.key} title={it.hint}>
            {onSelect ? (
              <button
                onClick={() => onSelect(it.key)}
                aria-pressed={activeKey === it.key}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 hover:bg-surface-2",
                  activeKey === it.key && "bg-surface-2",
                )}
              >
                {Inner}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1.5 py-1.5">{Inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Sequential heatmap in one hue (chart-1), light = few, dark = many. */
export function Heatmap({
  rows,
  cols,
  value,
  tooltip,
  format = (v) => String(v),
  cellLabel = false,
  minCell = 22,
}: {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string }[];
  value: (row: string, col: string) => number | null;
  tooltip: (row: string, col: string, v: number | null) => string;
  format?: (v: number) => string;
  cellLabel?: boolean;
  minCell?: number;
}) {
  let max = 0;
  for (const r of rows) for (const c of cols) max = Math.max(max, value(r.key, c.key) ?? 0);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[2px] text-[11px]"
        style={{ gridTemplateColumns: `minmax(90px, max-content) repeat(${cols.length}, minmax(${minCell}px, 1fr))` }}
        role="grid"
      >
        <div />
        {cols.map((c) => (
          <div key={c.key} className="truncate pb-1 text-center text-muted">
            {c.label}
          </div>
        ))}
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <div className="truncate pr-2 text-[12px] leading-[24px] text-muted">{r.label}</div>
            {cols.map((c) => {
              const v = value(r.key, c.key);
              const t = v && max ? 0.12 + 0.88 * (v / max) : 0;
              const id = `${r.key}|${c.key}`;
              return (
                <div
                  key={c.key}
                  role="gridcell"
                  title={tooltip(r.key, c.key, v)}
                  aria-label={tooltip(r.key, c.key, v)}
                  onMouseEnter={() => setHover(id)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "flex h-6 items-center justify-center rounded-[4px] bg-surface-2 transition-shadow",
                    hover === id && "ring-2 ring-fg/40",
                  )}
                  style={v ? { background: `color-mix(in oklab, var(--chart-1) ${Math.round(t * 100)}%, var(--surface-2))` } : undefined}
                >
                  {cellLabel && v ? (
                    <span className={cn("tabular font-medium", t > 0.55 ? "text-white" : "text-fg")}>{format(v)}</span>
                  ) : null}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <span>Less</span>
        {[0.12, 0.34, 0.56, 0.78, 1].map((t) => (
          <span
            key={t}
            className="h-2.5 w-5 rounded-[3px]"
            style={{ background: `color-mix(in oklab, var(--chart-1) ${Math.round(t * 100)}%, var(--surface-2))` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/** Big number + label, optionally with an icon and a small trend line. */
export function StatTile({
  label,
  value,
  icon,
  hint,
  onClick,
  active,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  tone?: "default" | "accent" | "hot";
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-4 text-left transition-colors duration-150",
        onClick && "hover:border-accent/60",
        active ? "border-accent" : "border-line",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {icon && (
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg",
              tone === "hot" ? "bg-hot-bg text-hot-fg" : tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="tabular mt-2 text-[28px] leading-none font-semibold">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-muted">{hint}</div>}
    </Comp>
  );
}

/** "Sample data" banner + Live/Sample switch used by pages that are not connected yet. */
export function DataSourceSwitch({
  mode,
  onChange,
  liveAvailable,
}: {
  mode: "live" | "sample";
  onChange: (m: "live" | "sample") => void;
  liveAvailable: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-medium" role="group" aria-label="Data source">
      {(["sample", "live"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          disabled={m === "live" && !liveAvailable}
          title={m === "live" && !liveAvailable ? "No live data yet" : undefined}
          className={cn(
            "h-7 rounded-md px-2.5 capitalize disabled:opacity-40",
            mode === m ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {m === "sample" ? "Sample data" : "Live data"}
        </button>
      ))}
    </div>
  );
}

/** Shared Recharts tooltip look. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  format?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] shadow-lg">
      {label != null && <div className="mb-1 font-medium">{format ? format(String(label)) : label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="tabular ml-auto font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
