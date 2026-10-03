import { Clock, Database, Rocket, TrendingUp, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/format";
import type { Account } from "@/lib/types";

type Chip = { key: string; icon: React.ReactNode; label: string; title: string; strong?: boolean };

/** The account's "why now" as short icon chips instead of a sentence. */
export function signalChips(a: Account): Chip[] {
  const chips: Chip[] = [];
  if (a.open_roles) {
    chips.push({
      key: "roles",
      icon: <Users size={12} />,
      label: `${a.open_roles} ${a.open_roles === 1 ? "role" : "roles"}`,
      title: `${a.open_roles} open roles in ${a.division_label ?? "one division"} (${a.builder_roles ?? 0} SDR/AE, ${a.leader_roles ?? 0} leader)`,
      strong: a.open_roles >= 3,
    });
  }
  if (a.new_leader_days != null) {
    chips.push({
      key: "leader",
      icon: <UserCheck size={12} />,
      label: `New leader · ${a.new_leader_days}d`,
      title: `New sales leader, ${a.new_leader_days} days in the role`,
      strong: a.new_leader_days <= 30,
    });
    const left = 90 - a.new_leader_days;
    if (left > 0) chips.push({ key: "window", icon: <Clock size={12} />, label: `${left}d window`, title: `Buying window closes in ~${left} days` });
  }
  const reasons = a.reasons.join(" ").toLowerCase();
  const crm = a.reasons.find((r) => r.startsWith("Job ads mention"))?.replace("Job ads mention ", "");
  if (crm) chips.push({ key: "crm", icon: <Database size={12} />, label: crm, title: `Job ads mention ${crm}` });
  if (reasons.includes("from scratch")) chips.push({ key: "scratch", icon: <Rocket size={12} />, label: "From scratch", title: "Building the sales team from scratch" });
  if (reasons.includes("new region")) chips.push({ key: "region", icon: <Rocket size={12} />, label: "New region", title: "Expanding into a new region" });
  const growth = a.reasons.find((r) => r.startsWith("Headcount +"));
  if (growth) chips.push({ key: "growth", icon: <TrendingUp size={12} />, label: growth.replace("Headcount ", "").replace(" in 6 months", ""), title: growth });
  return chips;
}

export function SignalChips({ account, max = 4, className }: { account: Account; max?: number; className?: string }) {
  const chips = signalChips(account).slice(0, max);
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap",
            c.strong ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
          )}
        >
          {c.icon}
          {c.label}
        </span>
      ))}
    </div>
  );
}
