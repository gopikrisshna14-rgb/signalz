"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Database, ExternalLink, Lock, Search, Sparkles, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, errorMessage, relativeTime } from "@/lib/format";
import type { Account, Bucket, JustChanged, Kpis, Tier, Workspace } from "@/lib/types";
import { BUCKET_LABELS } from "@/lib/types";
import { Avatar, Button, Card, CompanyLogo, Input, Pill, ScoreBar, TierPill } from "@/components/ui";
import { QuadrantChart } from "./quadrant-chart";
import { AccountDrawer } from "@/components/account/account-drawer";

type Tab = "all" | Exclude<Bucket, "other">;
type KpiFilter = null | "net_new" | "changed" | "new_leader";
type SortKey = "priority_score" | "cluster_score" | "fit_score" | "name" | "last_signal_at";

const TABS: Tab[] = ["call_today", "high_intent_weak_fit", "net_new", "warming_up", "recently_contacted", "all", "routed"];

interface Props {
  workspace: Workspace;
  accounts: Account[];
  kpis: Kpis | null;
  justChanged: JustChanged[];
  owners: { id: string; name: string }[];
  loadError: string | null;
}

export function Dashboard({ workspace, accounts, kpis, justChanged, owners, loadError }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("call_today");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"" | Tier>("");
  const [owner, setOwner] = useState("");
  const [country, setCountry] = useState("");
  const [hideClaimed, setHideClaimed] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "priority_score", desc: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const isAdmin = workspace.role !== "member";

  // Live updates: re-fetch the server data when scores or signals change.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const schedule = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 600);
    };
    const channel = supabase
      .channel(`dashboard-${workspace.orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_scores", filter: `org_id=eq.${workspace.orgId}` }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals", filter: `org_id=eq.${workspace.orgId}` }, schedule)
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router, workspace.orgId]);

  const countries = useMemo(
    () => [...new Set(accounts.map((a) => a.hq_country).filter(Boolean) as string[])].sort(),
    [accounts],
  );

  // Everything except the tab, so the tab counts reflect the other filters.
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (hideClaimed && a.owner_id && a.owner_id !== workspace.userId) return false;
      if (tier && a.tier !== tier) return false;
      if (owner === "me" && a.owner_id !== workspace.userId) return false;
      if (owner === "none" && a.owner_id) return false;
      if (owner && owner !== "me" && owner !== "none" && a.owner_id !== owner) return false;
      if (country && a.hq_country !== country) return false;
      if (kpiFilter === "net_new" && !(a.is_net_new && a.tier !== "cold")) return false;
      if (kpiFilter === "changed" && !a.changed_24h) return false;
      if (kpiFilter === "new_leader" && a.new_leader_days == null) return false;
      if (q) {
        const hay = [a.name, a.domain, a.division_label, a.contact_name, a.top_reason, a.industry].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, hideClaimed, tier, owner, country, kpiFilter, query, workspace.userId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: baseFiltered.length };
    for (const a of baseFiltered) c[a.bucket] = (c[a.bucket] ?? 0) + 1;
    return c;
  }, [baseFiltered]);

  const rows = useMemo(() => {
    const list = tab === "all" ? baseFiltered : baseFiltered.filter((a) => a.bucket === tab);
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return b.priority_score - a.priority_score;
    });
  }, [baseFiltered, tab, sort]);

  useEffect(() => setCursor(0), [tab, query, tier, owner, country, kpiFilter, hideClaimed]);

  const claim = useCallback(
    async (a: Account) => {
      const release = a.owner_id === workspace.userId;
      const { error } = await createClient().rpc("claim_account", { p_company: a.id, p_release: release });
      if (error) return toast.error(errorMessage(error));
      toast.success(release ? `Released ${a.name}` : `You own ${a.name} now`);
      router.refresh();
    },
    [router, workspace.userId],
  );

  // Keyboard: j/k move, enter open, c claim.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (selected || t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "j") setCursor((c) => Math.min(rows.length - 1, c + 1));
      else if (e.key === "k") setCursor((c) => Math.max(0, c - 1));
      else if (e.key === "Enter" && rows[cursor]) setSelected(rows[cursor]!.id);
      else if (e.key === "c" && rows[cursor]) claim(rows[cursor]!);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, selected, claim]);

  async function loadDemo() {
    setSeeding(true);
    const { error } = await createClient().rpc("seed_demo", { p_org: workspace.orgId });
    setSeeding(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Demo data loaded");
    router.refresh();
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));
  }

  function applyKpi(kind: "call_today" | KpiFilter | "routed") {
    if (kind === "call_today" || kind === "routed") {
      setKpiFilter(null);
      setTab(kind);
    } else {
      setKpiFilter((k) => (k === kind ? null : kind));
      setTab("all");
    }
  }

  const tiles = [
    { key: "call_today" as const, label: "Call today", value: kpis?.call_today ?? 0, active: tab === "call_today" && !kpiFilter },
    { key: "net_new" as const, label: "Net-new companies", value: kpis?.net_new ?? 0, active: kpiFilter === "net_new" },
    { key: "changed" as const, label: "New / upgraded in 24 h", value: kpis?.new_or_upgraded_24h ?? 0, active: kpiFilter === "changed" },
    { key: "new_leader" as const, label: "With a new sales leader", value: kpis?.with_new_leader ?? 0, active: kpiFilter === "new_leader" },
    { key: "routed" as const, label: "Routed to other teams", value: kpis?.routed ?? 0, active: tab === "routed" && !kpiFilter },
  ];

  const freshest = accounts.reduce<string | null>((m, a) => (a.last_signal_at && (!m || a.last_signal_at > m) ? a.last_signal_at : m), null);

  if (loadError) {
    return (
      <Card className="p-6">
        <h1 className="text-[16px] font-semibold">Could not load your accounts</h1>
        <p className="mt-1 text-muted">{loadError}</p>
        <p className="mt-3 text-[13px] text-muted">
          If this mentions a missing relation or view, run the SQL scripts in <code>supabase/</code> (001 → 005) in the
          Supabase SQL Editor.
        </p>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Sparkles size={20} />
        </span>
        <h1 className="text-[20px] font-semibold">No accounts yet</h1>
        <p className="mt-2 text-muted">
          Paste a LinkedIn URL to research a company, or load demo data to see how hiring clusters are scored.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {isAdmin && (
            <Button variant="primary" onClick={loadDemo} disabled={seeding}>
              <Database size={14} /> {seeding ? "Loading…" : "Load demo data"}
            </Button>
          )}
          <Button onClick={() => router.push("/research")}>
            <Search size={14} /> Research a LinkedIn URL
          </Button>
        </div>
        {!isAdmin && <p className="mt-4 text-[13px] text-muted">Only admins can load demo data.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Hiring signals</h1>
          <p className="text-[13px] text-muted">
            Prospects · last 45 days · data fresh to {freshest ? relativeTime(freshest) : "—"} · {accounts.length} companies tracked
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          I am
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-fg"
          >
            <option value="">Everyone</option>
            <option value="me">Me ({workspace.fullName ?? "you"})</option>
            <option value="none">Unclaimed</option>
            {owners
              .filter((o) => o.id !== workspace.userId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={() => applyKpi(t.key)}
            aria-pressed={t.active}
            className={cn(
              "rounded-xl border bg-surface p-4 text-left transition-colors duration-150 hover:border-accent/60",
              t.active ? "border-accent" : "border-line",
            )}
          >
            <div className="tabular text-[28px] leading-none font-semibold">{t.value}</div>
            <div className="mt-2 text-[13px] text-muted">{t.label}</div>
          </button>
        ))}
      </div>

      {/* Chart + just changed */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Hiring intent vs fit</h2>
            <div className="flex gap-3 text-[12px] text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-accent" /> Call today
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-orange" /> Net-new
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-muted" /> Other
              </span>
            </div>
          </div>
          <QuadrantChart accounts={baseFiltered} onSelect={setSelected} />
        </Card>
        <Card className="flex flex-col p-4">
          <h2 className="mb-3 text-[14px] font-semibold">Just changed</h2>
          {justChanged.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing new in the last 7 days.</p>
          ) : (
            <ul className="-mx-2 flex-1 space-y-0.5 overflow-y-auto" aria-live="polite">
              {justChanged.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s.company_id)}
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{s.company_name}</span>
                      <Pill
                        className={cn(
                          "shrink-0",
                          s.type === "tier_changed" ? "bg-hot-bg text-hot-fg" : "bg-accent-soft text-accent",
                        )}
                      >
                        {s.type === "tier_changed" ? "UPGRADED" : s.type === "hiring_cluster" ? "NEW" : "SIGNAL"}
                      </Pill>
                      <span className="ml-auto shrink-0 text-[12px] text-muted">{relativeTime(s.occurred_at)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-muted">
                      {s.title}
                      {s.owner_name ? ` · ${s.owner_name}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors",
                tab === t ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {t === "all" ? "All" : BUCKET_LABELS[t]}
              <span className="tabular rounded bg-surface-2 px-1.5 text-[11px] text-muted">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, division, contact"
            className="pl-8"
            aria-label="Search accounts"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as "" | Tier)}
          aria-label="Tier"
          className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
        >
          <option value="">All tiers</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Country"
          className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px]">
          <input type="checkbox" checked={kpiFilter === "changed"} onChange={(e) => setKpiFilter(e.target.checked ? "changed" : null)} />
          New/upgraded only
        </label>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px]">
          <input type="checkbox" checked={hideClaimed} onChange={(e) => setHideClaimed(e.target.checked)} />
          Hide claimed by others
        </label>
        {kpiFilter && (
          <Button size="sm" variant="ghost" onClick={() => setKpiFilter(null)}>
            Clear tile filter
          </Button>
        )}
      </div>

      {/* Table (desktop) */}
      {rows.length === 0 ? (
        <Card className="p-10 text-center text-muted">No accounts match these filters.</Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line bg-surface text-[12px] text-muted">
                  <tr>
                    <th className="w-16 px-4 py-2.5 font-medium">Tier</th>
                    <SortTh label="Company" k="name" sort={sort} onSort={toggleSort} />
                    <th className="px-3 py-2.5 font-medium">Division</th>
                    <th className="px-3 py-2.5 font-medium">Owner → contact</th>
                    <SortTh label="Cluster" k="cluster_score" sort={sort} onSort={toggleSort} align="right" />
                    <SortTh label="Fit" k="fit_score" sort={sort} onSort={toggleSort} align="right" />
                    <SortTh label="Priority" k="priority_score" sort={sort} onSort={toggleSort} />
                    <SortTh label="Last signal" k="last_signal_at" sort={sort} onSort={toggleSort} />
                    <th className="w-28 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className={cn(
                        "group cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60",
                        i === cursor && "bg-surface-2/60",
                      )}
                    >
                      <td className="px-4 py-3">
                        <TierPill tier={a.tier} />
                      </td>
                      <td className="max-w-[320px] px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <CompanyLogo name={a.name} src={a.logo_url} size={30} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{a.name}</span>
                              {a.is_net_new && <Pill className="bg-warm-bg text-warm-fg">Net-new</Pill>}
                            </div>
                            <div className="truncate text-[12px] text-muted">
                              {[a.domain, a.employee_count ? `${a.employee_count.toLocaleString()} emp.` : null].filter(Boolean).join(" · ")}
                            </div>
                            {a.top_reason && <div className="truncate text-[12px]">{a.top_reason}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px]">{a.division_label ?? <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={a.contact_name} src={a.contact_photo} size={26} />
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium">{a.contact_name ?? "No contact yet"}</div>
                            <div className="truncate text-[12px] text-muted">
                              {a.owner_name ? `${a.owner_name} → ` : ""}
                              {a.new_leader_days != null ? `${a.new_leader_days} d in role` : (a.contact_title ?? "")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="tabular px-3 py-3 text-right">{a.cluster_score}</td>
                      <td className="tabular px-3 py-3 text-right">{a.fit_score}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular w-6 text-right font-semibold">{a.priority_score}</span>
                          <ScoreBar value={a.priority_score} className="w-14" />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px] text-muted">{relativeTime(a.last_signal_at)}</td>
                      <td className="px-3 py-3">
                        <RowActions account={a} userId={workspace.userId} onClaim={claim} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cards (mobile) */}
          <div className="space-y-2 md:hidden">
            {rows.map((a) => (
              <Card key={a.id} className="p-3" onClick={() => setSelected(a.id)}>
                <div className="flex items-start gap-2.5">
                  <CompanyLogo name={a.name} src={a.logo_url} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{a.name}</span>
                      <TierPill tier={a.tier} />
                      <span className="tabular ml-auto font-semibold">{a.priority_score}</span>
                    </div>
                    <div className="truncate text-[12px] text-muted">{a.division_label ?? a.domain}</div>
                    {a.top_reason && <div className="mt-1 text-[12px]">{a.top_reason}</div>}
                    <div className="tabular mt-1.5 text-[12px] text-muted">
                      Cluster {a.cluster_score} · Fit {a.fit_score} · {relativeTime(a.last_signal_at)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="hidden text-[12px] text-muted md:block">
            Keyboard: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>Enter</kbd> open · <kbd>c</kbd> claim
          </p>
        </>
      )}

      <AccountDrawer
        accountId={selected}
        account={accounts.find((a) => a.id === selected) ?? null}
        workspace={workspace}
        onClose={() => setSelected(null)}
        onClaim={claim}
      />
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === k;
  return (
    <th className={cn("px-3 py-2.5 font-medium", align === "right" && "text-right")} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
        {label}
        {active && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );
}

function RowActions({ account: a, userId, onClaim }: { account: Account; userId: string; onClaim: (a: Account) => void }) {
  const mine = a.owner_id === userId;
  const other = a.owner_id && !mine;
  return (
    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!other) onClaim(a);
        }}
        title={other ? `Claimed by ${a.owner_name ?? "a teammate"}` : mine ? "Release" : "Claim"}
        aria-label={other ? "Claimed by someone else" : mine ? "Release account" : "Claim account"}
        disabled={Boolean(other)}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg disabled:opacity-40"
      >
        {other ? <Lock size={14} /> : <UserPlus size={14} />}
      </button>
      {(a.contact_linkedin ?? a.linkedin_url) && (
        <a
          href={(a.contact_linkedin ?? a.linkedin_url)!}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open on LinkedIn"
          aria-label="Open on LinkedIn"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
