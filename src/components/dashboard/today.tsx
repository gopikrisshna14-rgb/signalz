"use client";

import { CheckCircle2, Circle, Crosshair, Search, X } from "lucide-react";
import Link from "next/link";
import { parseAsBoolean, parseAsString, useQueryState, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountDrawer } from "@/components/account/account-drawer";
import { useAccountActions } from "@/components/account/use-actions";
import { openResearchDialog } from "@/components/shell/command-palette";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import type { AccountRow, KpiKey } from "@/lib/accounts";
import { countryName, timeOfDay } from "@/lib/format";
import { BUCKET_LABEL, type Bucket, type Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccountCards, AccountTable, type RowActions } from "./account-table";
import { JustChanged } from "./feed";
import { KpiTiles } from "./kpis";
import { Quadrant } from "./quadrant";

const TABS: (Bucket | "all")[] = ["call_today", "high_intent", "net_new", "warming_up", "recently_contacted", "routed", "other", "all"];

export interface Checklist {
  apify: boolean;
  research: boolean;
  icp: boolean;
  invite: boolean;
  export: boolean;
}

export interface TodayProps {
  rows: AccountRow[];
  kpis: Record<KpiKey, number>;
  deltas: Record<KpiKey, number | null>;
  feed: Signal[];
  freshAt: string | null;
  total: number;
  windowDays: number;
  me: { id: string; name: string };
  isAdmin: boolean;
  members: { userId: string; name: string }[];
  checklist: Checklist;
}

function FirstRun({ c }: { c: Checklist }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("checklist") === "hidden");
    } catch {
      setHidden(false);
    }
  }, []);
  const items = [
    { done: c.apify, label: "Connect Apify", href: "/settings?tab=sources" },
    { done: c.research, label: "Research a first URL", onClick: () => openResearchDialog() },
    { done: c.icp, label: "Set your ICP", href: "/settings?tab=icp" },
    { done: c.invite, label: "Invite a teammate", href: "/settings?tab=team" },
    { done: c.export, label: "Export to CRM", href: "/settings?tab=integrations" },
  ];
  const left = items.filter((i) => !i.done).length;
  if (hidden || left === 0) return null;
  return (
    <section aria-label="Getting started" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="text-[13px] font-semibold">
        Getting started · {items.length - left}/{items.length}
      </span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-1.5">
            {i.done ? <CheckCircle2 size={14} className="text-ok" aria-label="Done" /> : <Circle size={14} className="text-muted" aria-label="To do" />}
            {i.done ? (
              <span className="text-muted line-through">{i.label}</span>
            ) : i.href ? (
              <Link href={i.href} className="hover:underline">
                {i.label}
              </Link>
            ) : (
              <button onClick={i.onClick} className="hover:underline">
                {i.label}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        className="ml-auto rounded-md p-1 text-muted hover:bg-hover"
        aria-label="Hide checklist"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem("checklist", "hidden");
          } catch {}
        }}
      >
        <X size={14} />
      </button>
    </section>
  );
}

export function TodayView(p: TodayProps) {
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("call_today"));
  const [f, setF] = useQueryStates({
    q: parseAsString.withDefault(""),
    tier: parseAsString.withDefault(""),
    owner: parseAsString.withDefault(""),
    country: parseAsString.withDefault(""),
    fn: parseAsString.withDefault(""),
    changed: parseAsBoolean.withDefault(false),
    leader: parseAsBoolean.withDefault(false),
    hideClaimed: parseAsBoolean.withDefault(true),
  });
  const [account, setAccount] = useQueryState("account");
  const [rows, setRows] = useState(p.rows);
  useEffect(() => setRows(p.rows), [p.rows]);

  const onOptimistic = useCallback((id: string, patch: { owner?: { userId: string; name: string } | null; contacted?: boolean }) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id !== id ? r : { ...r, ...(patch.owner !== undefined ? { owner: patch.owner } : {}), ...(patch.contacted ? { bucket: "recently_contacted" as Bucket, owner: r.owner ?? { userId: p.me.id, name: p.me.name } } : {}) },
      ),
    );
  }, [p.me]);
  const actions = useAccountActions({ onOptimistic, me: p.me });

  const filtered = useMemo(() => {
    const q = f.q.toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.domain ?? ""} ${r.division ?? ""} ${r.contact?.name ?? ""}`.toLowerCase().includes(q)) return false;
      if (f.tier && r.tier !== f.tier) return false;
      if (f.owner === "me" && r.owner?.userId !== p.me.id) return false;
      if (f.owner === "unclaimed" && r.owner) return false;
      if (f.owner && !["me", "unclaimed"].includes(f.owner) && r.owner?.userId !== f.owner) return false;
      if (f.country && r.country !== f.country) return false;
      if (f.fn && !r.functions.includes(f.fn)) return false;
      if (f.changed && !r.change) return false;
      if (f.leader && !r.newLeader) return false;
      if (f.hideClaimed && r.owner && r.owner.userId !== p.me.id) return false;
      return true;
    });
  }, [rows, f, p.me.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: filtered.length };
    for (const r of filtered) c[r.bucket] = (c[r.bucket] ?? 0) + 1;
    return c;
  }, [filtered]);
  const visible = useMemo(() => (tab === "all" ? filtered : filtered.filter((r) => r.bucket === tab)), [filtered, tab]);

  // Keyboard: j/k move, enter opens, c claims, l opens the log menu.
  const [order, setOrder] = useState<string[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [logMenuFor, setLogMenuFor] = useState<string | null>(null);
  const byId = useMemo(() => new Map(visible.map((r) => [r.id, r])), [visible]);
  useEffect(() => setFocusIdx(0), [tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,select,[contenteditable],[role=dialog],[role=menu]")) return;
      if (account) return;
      const row = byId.get(order[focusIdx]);
      if (e.key === "j") setFocusIdx((i) => Math.min(order.length - 1, i + 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(0, i - 1));
      else if (e.key === "Enter" && row) void setAccount(row.id);
      else if (e.key === "c" && row && !row.owner) void actions.claim(row.id, row.name);
      else if (e.key === "l" && row) setLogMenuFor(row.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, focusIdx, byId, account, setAccount, actions]);

  const rowActions: RowActions = useMemo(
    () => ({
      me: p.me.id,
      isAdmin: p.isAdmin,
      open: (id) => void setAccount(id),
      claim: (r) => void actions.claim(r.id, r.name),
      release: (r) => void actions.release(r.id, r.name),
      log: (r, t) => void actions.log(r.id, r.name, t, { personId: r.contact?.id ?? null }),
    }),
    [p.me.id, p.isAdmin, setAccount, actions],
  );

  const onKpi = (k: KpiKey) => {
    if (k === "call_today" || k === "net_new" || k === "routed") {
      void setTab(k);
      void setF({ changed: false, leader: false });
    } else {
      void setTab("all");
      void setF({ changed: k === "changed_24h", leader: k === "new_leader" });
    }
  };
  const activeKpi: KpiKey | null = f.changed ? "changed_24h" : f.leader ? "new_leader" : tab === "call_today" || tab === "net_new" || tab === "routed" ? (tab as KpiKey) : null;
  const countries = [...new Set(rows.map((r) => r.country).filter(Boolean) as string[])].sort();
  const anyFilter = Boolean(f.q || f.tier || f.owner || f.country || f.fn || f.changed || f.leader);

  if (p.total === 0)
    return (
      <div className="space-y-4">
        <Header {...p} />
        <FirstRun c={p.checklist} />
        <EmptyState
          className="py-16"
          icon={<Crosshair size={18} />}
          title="No accounts yet"
          text="Research a LinkedIn profile or company URL. Admins can also load demo data in Settings → Data sources."
          action={
            <Button variant="primary" onClick={() => openResearchDialog()}>
              Research a LinkedIn URL
            </Button>
          }
        />
      </div>
    );

  return (
    <div className="space-y-4">
      <Header {...p} />
      <FirstRun c={p.checklist} />
      <KpiTiles kpis={p.kpis} deltas={p.deltas} active={activeKpi} onSelect={onKpi} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Quadrant rows={filtered.filter((r) => r.cluster > 0 || r.fit > 0)} onOpen={(id) => void setAccount(id)} />
        <JustChanged initial={p.feed} onOpen={(id) => void setAccount(id)} />
      </div>

      <section aria-label="Accounts" className="space-y-3">
        <div role="tablist" aria-label="Buckets" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => void setTab(t)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-muted hover:text-fg",
                tab === t && "border-accent text-fg",
              )}
            >
              {t === "all" ? "All" : BUCKET_LABEL[t]}
              <span className="tabular rounded-full bg-surface-2 px-1.5 text-[11px]">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search accounts" placeholder="Search" value={f.q} onChange={(e) => void setF({ q: e.target.value || null })} className="h-8 pl-8 text-[13px]" />
          </div>
          <Select aria-label="Tier" value={f.tier} onChange={(e) => void setF({ tier: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any tier</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </Select>
          <Select aria-label="Owner" value={f.owner} onChange={(e) => void setF({ owner: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any owner</option>
            <option value="me">Mine</option>
            <option value="unclaimed">Unclaimed</option>
            {p.members
              .filter((m) => m.userId !== p.me.id)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
          </Select>
          <Select aria-label="Country" value={f.country} onChange={(e) => void setF({ country: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any country</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </Select>
          <Select aria-label="Function" value={f.fn} onChange={(e) => void setF({ fn: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any function</option>
            <option value="sales">Sales</option>
            <option value="marketing">Marketing</option>
            <option value="customer_success">Customer Success</option>
          </Select>
          <Switch id="f-changed" checked={f.changed} onCheckedChange={(v) => void setF({ changed: v || null })} label="New/upgraded only" />
          <Switch id="f-hide" checked={f.hideClaimed} onCheckedChange={(v) => void setF({ hideClaimed: v })} label="Hide claimed by others" />
          {anyFilter ? (
            <Button size="sm" variant="ghost" onClick={() => void setF({ q: null, tier: null, owner: null, country: null, fn: null, changed: null, leader: null })}>
              Clear filters
            </Button>
          ) : null}
          <span className="ml-auto hidden text-[12px] text-muted lg:inline">
            <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>enter</kbd> open · <kbd>c</kbd> claim · <kbd>l</kbd> log
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={anyFilter ? "No accounts match these filters" : `Nothing in ${tab === "all" ? "this list" : BUCKET_LABEL[tab as Bucket]} right now`}
            text={anyFilter ? "Try clearing a filter." : "Check the other tabs, or research more companies."}
            action={
              anyFilter ? (
                <Button size="sm" onClick={() => void setF({ q: null, tier: null, owner: null, country: null, fn: null, changed: null, leader: null })}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => void setTab("all")}>
                  Show all accounts
                </Button>
              )
            }
          />
        ) : (
          <>
            <AccountTable rows={visible} a={rowActions} focusIdx={focusIdx} setFocusIdx={setFocusIdx} logMenuFor={logMenuFor} setLogMenuFor={setLogMenuFor} onOrder={setOrder} />
            <AccountCards rows={visible} a={rowActions} />
          </>
        )}
      </section>
      <AccountDrawer id={account} onClose={() => void setAccount(null)} />
    </div>
  );
}

function Header({ freshAt, total, windowDays }: TodayProps) {
  return (
    <header>
      <h1 className="text-[20px] font-semibold">Hiring signals</h1>
      <p className="mt-0.5 text-[13px] text-muted">
        last {windowDays} days · data fresh to {freshAt ? `${new Date(freshAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${timeOfDay(freshAt)}` : "—"} · {total}{" "}
        {total === 1 ? "company" : "companies"}
      </p>
    </header>
  );
}
