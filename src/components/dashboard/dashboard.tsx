"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Database,
  ExternalLink,
  Flame,
  Lock,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, errorMessage, relativeTime } from "@/lib/format";
import type { Account, Bucket, JustChanged, Kpis, Tier, Workspace } from "@/lib/types";
import { BUCKET_LABELS } from "@/lib/types";
import { Avatar, Button, Card, CompanyLogo, Input, Pill, ScoreBar, TierPill } from "@/components/ui";
import { ChartCard, StatTile } from "@/components/charts";
import { AccountDrawer } from "@/components/account/account-drawer";
import { MarketScanStatus } from "@/components/market-scan-status";
import type { MarketScanRun } from "@/lib/market-scan";
import { QuadrantChart } from "./quadrant-chart";
import { Spotlight } from "./spotlight";
import { SignalChips } from "./signal-chips";
import { RegionMix, SIGNAL_LABELS, SignalMix, TierMix, hasSignal, regionOf, type SignalKey } from "./insights";

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
  marketScans?: MarketScanRun[];
}

function firstName(ws: Workspace) {
  const name = ws.fullName?.trim() || ws.email?.split("@")[0] || "";
  const first = name.split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Dashboard({ workspace, accounts, kpis, justChanged, owners, loadError, marketScans = [] }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [signal, setSignal] = useState<SignalKey | null>(null);
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<"" | Tier>("");
  const [owner, setOwner] = useState("");
  const [country, setCountry] = useState("");
  const [hideClaimed, setHideClaimed] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "priority_score", desc: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [hello, setHello] = useState("Welcome");
  const isAdmin = workspace.role !== "member";
  const name = firstName(workspace);

  useEffect(() => setHello(greeting()), []);

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

  // Accounts this SDR may work: hides accounts another SDR has claimed (if toggled).
  const visible = useMemo(
    () => accounts.filter((a) => !(hideClaimed && a.owner_id && a.owner_id !== workspace.userId)),
    [accounts, hideClaimed, workspace.userId],
  );

  // Everything except the tab, so the tab counts reflect the other filters.
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter((a) => {
      if (tier && a.tier !== tier) return false;
      if (owner === "me" && a.owner_id !== workspace.userId) return false;
      if (owner === "none" && a.owner_id) return false;
      if (owner && owner !== "me" && owner !== "none" && a.owner_id !== owner) return false;
      if (country && a.hq_country !== country) return false;
      if (region && regionOf(a) !== region) return false;
      if (signal && !hasSignal(a, signal)) return false;
      if (kpiFilter === "net_new" && !(a.is_net_new && a.tier !== "cold")) return false;
      if (kpiFilter === "changed" && !a.changed_24h) return false;
      if (kpiFilter === "new_leader" && a.new_leader_days == null) return false;
      if (q) {
        const hay = [a.name, a.domain, a.division_label, a.contact_name, a.top_reason, a.industry].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visible, tier, owner, country, region, signal, kpiFilter, query, workspace.userId]);

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

  const shortlist = useMemo(() => {
    const open = visible.filter((a) => !["recently_contacted", "routed"].includes(a.bucket) && a.status === "prospect");
    const callToday = open.filter((a) => a.bucket === "call_today");
    const rest = open.filter((a) => a.bucket !== "call_today");
    return [...callToday, ...rest].slice(0, 6);
  }, [visible]);

  useEffect(() => setCursor(0), [tab, query, tier, owner, country, region, signal, kpiFilter, hideClaimed]);

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
      setTab((t) => (t === kind ? "all" : kind));
    } else {
      setKpiFilter((k) => (k === kind ? null : kind));
      setTab("all");
    }
  }

  function clearFilters() {
    setKpiFilter(null);
    setSignal(null);
    setRegion("");
    setTier("");
    setCountry("");
    setQuery("");
    setOwner("");
    setTab("all");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (tier) activeChips.push({ label: `Tier: ${tier}`, clear: () => setTier("") });
  if (signal) activeChips.push({ label: SIGNAL_LABELS[signal], clear: () => setSignal(null) });
  if (region) activeChips.push({ label: `Region: ${region}`, clear: () => setRegion("") });
  if (kpiFilter === "net_new") activeChips.push({ label: "Net-new", clear: () => setKpiFilter(null) });
  if (kpiFilter === "changed") activeChips.push({ label: "New / upgraded 24 h", clear: () => setKpiFilter(null) });
  if (kpiFilter === "new_leader") activeChips.push({ label: "New sales leader", clear: () => setKpiFilter(null) });

  const freshest = accounts.reduce<string | null>((m, a) => (a.last_signal_at && (!m || a.last_signal_at > m) ? a.last_signal_at : m), null);
  const callTodayCount = kpis?.call_today ?? 0;
  const changedCount = kpis?.new_or_upgraded_24h ?? 0;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          {hello}
          {name ? `, ${name}` : ""} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-0.5 text-[14px] text-muted">
          {accounts.length === 0 ? (
            <>Welcome to Signalz. Let&apos;s find your first accounts.</>
          ) : (
            <>
              <span className="font-medium text-fg">{callTodayCount} to call today</span>
              {changedCount > 0 && <> · {changedCount} new or upgraded since yesterday</>} · data from {freshest ? relativeTime(freshest) : "—"}
            </>
          )}
        </p>
      </div>
      {accounts.length > 0 && (
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Show
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-fg"
          >
            <option value="">Everyone&apos;s accounts</option>
            <option value="me">My accounts</option>
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
      )}
    </div>
  );

  if (loadError) {
    return (
      <div className="space-y-5">
        {header}
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold">Could not load your accounts</h2>
          <p className="mt-1 text-muted">{loadError}</p>
          <p className="mt-3 text-[13px] text-muted">
            If this mentions a missing relation or view, run the SQL scripts in <code>supabase/</code> (001 → 005) in the
            Supabase SQL Editor.
          </p>
        </Card>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <MarketScanStatus runs={marketScans} />
        <Card className="mx-auto max-w-xl px-6 py-12 text-center">
          <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Sparkles size={20} />
          </span>
          <h2 className="text-[18px] font-semibold">No accounts yet</h2>
          <p className="mt-2 text-muted">Load demo data to see how hiring clusters are scored, or research a LinkedIn URL.</p>
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
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <MarketScanStatus runs={marketScans} />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Call today"
          value={callTodayCount}
          icon={<Flame size={15} />}
          tone="hot"
          active={tab === "call_today"}
          onClick={() => applyKpi("call_today")}
        />
        <StatTile
          label="Net-new"
          value={kpis?.net_new ?? 0}
          icon={<Sparkles size={15} />}
          tone="accent"
          active={kpiFilter === "net_new"}
          onClick={() => applyKpi("net_new")}
        />
        <StatTile
          label="New / upgraded 24 h"
          value={changedCount}
          icon={<TrendingUp size={15} />}
          tone="accent"
          active={kpiFilter === "changed"}
          onClick={() => applyKpi("changed")}
        />
        <StatTile
          label="New sales leader"
          value={kpis?.with_new_leader ?? 0}
          icon={<UserCheck size={15} />}
          tone="accent"
          active={kpiFilter === "new_leader"}
          onClick={() => applyKpi("new_leader")}
        />
        <StatTile
          label="Routed"
          value={kpis?.routed ?? 0}
          icon={<Share2 size={15} />}
          active={tab === "routed"}
          onClick={() => applyKpi("routed")}
        />
      </div>

      <Spotlight accounts={shortlist} onSelect={setSelected} />

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Hiring intent vs fit"
          subtitle="Top-right = call today · bubble size = open roles"
          className="lg:col-span-2"
          action={
            <div className="hidden gap-3 text-[12px] text-muted sm:flex">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-1" /> Call today
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-2" /> Net-new
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-muted" /> Other
              </span>
            </div>
          }
          table={{
            head: ["Company", "Cluster", "Fit", "Bucket"],
            rows: baseFiltered.map((a) => [a.name, a.cluster_score, a.fit_score, BUCKET_LABELS[a.bucket]]),
          }}
        >
          <QuadrantChart accounts={baseFiltered} onSelect={setSelected} />
        </ChartCard>
        <SignalMix accounts={visible} active={signal} onSelect={setSignal} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TierMix accounts={visible} active={tier} onSelect={setTier} />
        <RegionMix accounts={visible} active={region} onSelect={setRegion} />
        <ChartCard title="Just changed" subtitle="Last 7 days">
          {justChanged.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing new in the last 7 days.</p>
          ) : (
            <ul className="-mx-1.5 max-h-[220px] space-y-0.5 overflow-y-auto" aria-live="polite">
              {justChanged.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s.company_id)}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-2"
                    title={s.title}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                        s.type === "tier_changed" ? "bg-hot-bg text-hot-fg" : "bg-accent-soft text-accent",
                      )}
                    >
                      {s.type === "tier_changed" ? <TrendingUp size={13} /> : s.type === "new_sales_leader" ? <UserCheck size={13} /> : <Sparkles size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{s.company_name}</span>
                      <span className="block truncate text-[12px] text-muted">{s.type === "tier_changed" ? s.title : s.type === "hiring_cluster" ? "New hiring cluster" : s.title}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted">{relativeTime(s.occurred_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Account list */}
      <section className="space-y-3" aria-label="All accounts">
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts"
              className="pl-8"
              aria-label="Search accounts"
            />
          </div>
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
            <input type="checkbox" checked={hideClaimed} onChange={(e) => setHideClaimed(e.target.checked)} />
            Hide claimed by others
          </label>
          {activeChips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-[12px] font-medium text-accent capitalize"
            >
              {c.label} <X size={12} />
            </button>
          ))}
          {activeChips.length > 1 && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear all
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center text-muted">No accounts match these filters.</Card>
        ) : (
          <>
            <Card className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-line bg-surface text-[12px] text-muted">
                    <tr>
                      <SortTh label="Priority" k="priority_score" sort={sort} onSort={toggleSort} className="pl-4" />
                      <SortTh label="Company" k="name" sort={sort} onSort={toggleSort} />
                      <th className="px-3 py-2.5 font-medium">Signals</th>
                      <th className="px-3 py-2.5 font-medium">Contact</th>
                      <SortTh label="Cluster" k="cluster_score" sort={sort} onSort={toggleSort} align="right" />
                      <SortTh label="Fit" k="fit_score" sort={sort} onSort={toggleSort} align="right" />
                      <SortTh label="Last signal" k="last_signal_at" sort={sort} onSort={toggleSort} />
                      <th className="w-24 px-3 py-2.5" />
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
                        <td className="py-3 pr-3 pl-4">
                          <div className="flex items-center gap-2">
                            <span className="tabular w-6 text-right text-[14px] font-semibold">{a.priority_score}</span>
                            <div className="w-12">
                              <ScoreBar value={a.priority_score} />
                              <TierPill tier={a.tier} className="mt-1 h-4 px-1 text-[10px]" />
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[260px] px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo name={a.name} src={a.logo_url} size={30} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-medium">{a.name}</span>
                                {a.is_net_new && <Pill className="bg-warm-bg text-warm-fg">New</Pill>}
                              </div>
                              <div className="truncate text-[12px] text-muted">{a.division_label ?? a.domain}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <SignalChips account={a} max={3} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={a.contact_name} src={a.contact_photo} size={26} />
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-medium">{a.contact_name ?? "—"}</div>
                              <div className="truncate text-[12px] text-muted">{a.owner_name ? `Owner: ${a.owner_name}` : "Unclaimed"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="tabular px-3 py-3 text-right">{a.cluster_score}</td>
                        <td className="tabular px-3 py-3 text-right">{a.fit_score}</td>
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
                      <SignalChips account={a} max={3} className="mt-1.5" />
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
      </section>

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
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
  align?: "right";
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th
      className={cn("px-3 py-2.5 font-medium", align === "right" && "text-right", className)}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
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
    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
