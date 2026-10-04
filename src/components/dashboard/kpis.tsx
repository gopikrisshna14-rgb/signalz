"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { KpiKey } from "@/lib/accounts";
import { cn } from "@/lib/utils";

const TILES: { key: KpiKey; label: string; hint: string }[] = [
  { key: "call_today", label: "Call today", hint: "Strong cluster and strong fit" },
  { key: "net_new", label: "Net-new", hint: "Not in your CRM yet, Warm or better" },
  { key: "changed_24h", label: "New/upgraded in 24 h", hint: "New clusters and tier upgrades" },
  { key: "new_leader", label: "With a new sales leader", hint: "Leader started within the tenure window" },
  { key: "routed", label: "Routed", hint: "Existing customers or routed elsewhere" },
];

export function KpiTiles({ kpis, deltas, active, onSelect }: { kpis: Record<KpiKey, number>; deltas: Record<KpiKey, number | null>; active: KpiKey | null; onSelect: (k: KpiKey) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map((t) => {
        const d = deltas[t.key];
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            aria-pressed={active === t.key}
            title={t.hint}
            className={cn(
              "rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-150 hover:bg-hover",
              active === t.key && "border-accent ring-1 ring-accent",
              t.key === "routed" && "col-span-2 sm:col-span-1",
            )}
          >
            <div className="text-[12px] font-medium text-muted">{t.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-[28px] leading-none font-semibold">{kpis[t.key]}</span>
              <span className="tabular flex items-center gap-0.5 text-[12px] text-muted">
                {d === null ? (
                  <span>no 7-day data yet</span>
                ) : d === 0 ? (
                  <>
                    <Minus size={12} aria-hidden /> 0 vs 7 d
                  </>
                ) : (
                  <>
                    {d > 0 ? <ArrowUpRight size={12} className="text-ok" aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                    {d > 0 ? `+${d}` : d} vs 7 d
                  </>
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
