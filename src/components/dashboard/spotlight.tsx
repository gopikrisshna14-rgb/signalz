"use client";

import { ArrowRight } from "lucide-react";
import type { Account } from "@/lib/types";
import { Card, CompanyLogo, TierPill } from "@/components/ui";
import { SignalChips } from "./signal-chips";

function Ring({ value, size = 40 }: { value: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Priority ${value}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.32} fontWeight="600" fill="var(--text)" className="tabular">
        {value}
      </text>
    </svg>
  );
}

/** The SDR's shortlist: the top accounts as scannable cards. */
export function Spotlight({ accounts, onSelect }: { accounts: Account[]; onSelect: (id: string) => void }) {
  if (accounts.length === 0) return null;
  return (
    <section aria-label="Call these first">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold">Call these first</h2>
        <span className="text-[12px] text-muted">Highest priority, not claimed by others</span>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
        {accounts.map((a, i) => (
          <Card key={a.id} className="w-[250px] shrink-0 snap-start md:w-auto">
            <button onClick={() => onSelect(a.id)} className="flex h-full w-full flex-col gap-2.5 p-3.5 text-left">
              <div className="flex items-start gap-2.5">
                <CompanyLogo name={a.name} src={a.logo_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted">#{i + 1}</span>
                    <TierPill tier={a.tier} />
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold">{a.name}</div>
                </div>
                <Ring value={a.priority_score} />
              </div>
              <div className="truncate text-[12px] text-muted">{a.division_label ?? a.industry ?? "—"}</div>
              <SignalChips account={a} max={3} />
              <div className="mt-auto flex items-center justify-between pt-1 text-[12px]">
                <span className="truncate text-muted">{a.contact_name ?? "No contact yet"}</span>
                <span className="inline-flex items-center gap-0.5 font-medium text-accent">
                  Open <ArrowRight size={12} />
                </span>
              </div>
            </button>
          </Card>
        ))}
      </div>
    </section>
  );
}
