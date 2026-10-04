"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Factor } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "./tooltip";

export function FactorList({ factors, total, note }: { factors: Factor[]; total?: number; note?: string }) {
  return (
    <div className="text-[13px]">
      <ul className="space-y-1">
        {factors.map((f, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className={cn("tabular w-9 shrink-0 text-right font-semibold", f.points > 0 ? "text-accent" : "text-muted")}>
              {f.points > 0 ? `+${f.points}` : f.points}
            </span>
            <span className="min-w-0">{f.label}</span>
          </li>
        ))}
        {factors.length === 0 ? <li className="text-muted">No factors yet</li> : null}
      </ul>
      {total !== undefined ? (
        <div className="mt-2 flex items-baseline gap-2 border-t border-line pt-2 font-semibold">
          <span className="tabular w-9 text-right">{total}</span>
          <span>Total{note ? <span className="font-normal text-muted"> · {note}</span> : null}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A score that always reveals its breakdown on click (and on hover via title). Never a bare number. */
export function ScoreChip({ label, value, factors, note, className }: { label: string; value: number; factors: Factor[]; note?: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn("tabular rounded-md px-1.5 py-0.5 text-[13px] font-semibold underline decoration-line decoration-dotted underline-offset-4 hover:bg-hover", className)}
        aria-label={`${label} ${value}, show breakdown`}
        title={factors.map((f) => `${f.points >= 0 ? "+" : ""}${f.points} ${f.label}`).join("\n")}
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">{label}</div>
        <FactorList factors={factors} total={value} note={note} />
      </PopoverContent>
    </Popover>
  );
}

export function Bar({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "hot" | "warm" | "muted" }) {
  const color = { accent: "bg-accent", hot: "bg-hot-fg", warm: "bg-warm-fg", muted: "bg-muted" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} aria-hidden>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function PriorityRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Priority ${value} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="tabular absolute text-[16px] font-semibold">{value}</span>
    </span>
  );
}
