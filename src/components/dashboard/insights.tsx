"use client";

import type { Account, Tier } from "@/lib/types";
import { TierPill } from "@/components/ui";
import { BarList, ChartCard } from "@/components/charts";

export type SignalKey = "leader" | "roles3" | "crm" | "scratch" | "region" | "growth";

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  leader: "New sales leader",
  roles3: "3+ open roles",
  crm: "Competitor CRM in job ads",
  scratch: "Building from scratch",
  region: "Expanding to a new region",
  growth: "Headcount growing fast",
};

export function hasSignal(a: Account, k: SignalKey): boolean {
  const text = a.reasons.join(" ").toLowerCase();
  switch (k) {
    case "leader":
      return a.new_leader_days != null;
    case "roles3":
      return (a.open_roles ?? 0) >= 3;
    case "crm": {
      const r = a.reasons.find((x) => x.startsWith("Job ads mention"));
      return Boolean(r && r.replace("Job ads mention ", "").split(", ").some((c) => c !== "hubspot"));
    }
    case "scratch":
      return text.includes("from scratch");
    case "region":
      return text.includes("new region");
    case "growth":
      return text.includes("headcount +");
  }
}

export function regionOf(a: Account): string {
  const parts = (a.division_label ?? "").split(" · ");
  return parts.length >= 2 ? parts[parts.length - 1]! : (a.hq_country ?? "Unknown");
}

export function TierMix({ accounts, active, onSelect }: { accounts: Account[]; active: Tier | ""; onSelect: (t: Tier | "") => void }) {
  const tiers: Tier[] = ["hot", "warm", "cold"];
  const items = tiers.map((t) => ({
    key: t,
    label: (
      <span className="flex items-center gap-2">
        <TierPill tier={t} />
        <span className="text-muted">{Math.round((accounts.filter((a) => a.tier === t).length / Math.max(1, accounts.length)) * 100)}%</span>
      </span>
    ),
    value: accounts.filter((a) => a.tier === t).length,
    hint: `${accounts.filter((a) => a.tier === t).length} ${t} accounts`,
  }));
  return (
    <ChartCard
      title="Tier mix"
      subtitle="Click to filter the list"
      table={{ head: ["Tier", "Accounts"], rows: items.map((i) => [i.key, i.value]) }}
    >
      <BarList items={items} activeKey={active || null} onSelect={(k) => onSelect(active === k ? "" : (k as Tier))} />
    </ChartCard>
  );
}

export function SignalMix({
  accounts,
  active,
  onSelect,
}: {
  accounts: Account[];
  active: SignalKey | null;
  onSelect: (k: SignalKey | null) => void;
}) {
  const items = (Object.keys(SIGNAL_LABELS) as SignalKey[])
    .map((k) => ({ key: k, label: SIGNAL_LABELS[k], value: accounts.filter((a) => hasSignal(a, k)).length }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <ChartCard
      title="Why now"
      subtitle="Accounts per buying signal"
      table={{ head: ["Signal", "Accounts"], rows: items.map((i) => [i.label, i.value]) }}
    >
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">No signals yet.</p>
      ) : (
        <BarList items={items} activeKey={active} onSelect={(k) => onSelect(active === k ? null : (k as SignalKey))} />
      )}
    </ChartCard>
  );
}

export function RegionMix({ accounts, active, onSelect }: { accounts: Account[]; active: string; onSelect: (r: string) => void }) {
  const counts = new Map<string, number>();
  for (const a of accounts) if (a.open_roles) counts.set(regionOf(a), (counts.get(regionOf(a)) ?? 0) + (a.open_roles ?? 0));
  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => ({ key: k, label: k, value: v, hint: `${v} open sales roles in ${k}` }));
  return (
    <ChartCard
      title="Where they're hiring"
      subtitle="Open sales roles by region"
      table={{ head: ["Region", "Open roles"], rows: items.map((i) => [i.label, i.value]) }}
    >
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">No open roles yet.</p>
      ) : (
        <BarList items={items} activeKey={active || null} onSelect={(k) => onSelect(active === k ? "" : k)} />
      )}
    </ChartCard>
  );
}
