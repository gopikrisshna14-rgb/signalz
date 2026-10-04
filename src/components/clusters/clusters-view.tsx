"use client";

import { Network, Search } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";
import { ChartCard, DataTable, HBars, Heatmap, TrendLine } from "@/components/charts";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { TierPill } from "@/components/ui/pills";
import { ScoreChip } from "@/components/ui/score";
import type { ClusterRow } from "@/lib/analytics";
import { FUNCTION_LABEL } from "@/lib/pipeline/rules";
import { relativeTime } from "@/lib/format";
import type { JobFunction, Tier } from "@/lib/types";

interface Props {
  rows: ClusterRow[];
  fnRegion: { rows: string[]; cols: string[]; cells: number[][] };
  divisionWeeks: { companyId: string; name: string; label: string; weeks: number[] }[];
  weeks: string[];
  perWeek: { week: string; clusters: number }[];
  families: { family: string; roles: number }[];
  windowDays: number;
}

export function ClustersView(p: Props) {
  const [f, setF] = useQueryStates({ q: parseAsString.withDefault(""), region: parseAsString.withDefault(""), fn: parseAsString.withDefault(""), min: parseAsInteger.withDefault(0) });
  const regions = [...new Set(p.rows.map((r) => r.region))].sort();
  const list = useMemo(
    () =>
      p.rows.filter(
        (r) =>
          (!f.q || `${r.companyName} ${r.label}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.region || r.region === f.region) && (!f.fn || r.function === f.fn) && r.index >= f.min,
      ),
    [p.rows, f],
  );
  const fnLabel = (x: string) => FUNCTION_LABEL[x as JobFunction] ?? x;

  if (!p.rows.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[20px] font-semibold">Clusters</h1>
        <EmptyState icon={<Network size={18} />} title="No hiring clusters yet" text="Clusters appear when a company posts several sales roles in one division. Research companies or run a market scan." action={<Link href="/research" className="text-[13px] text-accent hover:underline">Go to Research</Link>} />
      </div>
    );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-semibold">Clusters</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {p.rows.length} active clusters · roles posted in the last {p.windowDays} days
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Open roles by function × region"
          description="Counted roles in active clusters"
          chart={<Heatmap rows={p.fnRegion.rows.map(fnLabel)} cols={p.fnRegion.cols} cells={p.fnRegion.cells} unit="open roles" label="Heatmap of open roles by function and region" />}
          table={<DataTable caption="Open roles by function and region" head={["Function", ...p.fnRegion.cols]} rows={p.fnRegion.rows.map((r, i) => [fnLabel(r), ...p.fnRegion.cells[i]])} />}
        />
        <ChartCard
          title="New clusters per week"
          description="Last 12 weeks"
          chart={<TrendLine data={p.perWeek} x="week" y="clusters" unit="new clusters" label="Line chart of new clusters per week" />}
          table={<DataTable caption="New clusters per week" head={["Week of", "New clusters"]} rows={p.perWeek.map((w) => [w.week, w.clusters])} />}
        />
        <ChartCard
          className="lg:col-span-2"
          title="Division × week, top 20 accounts"
          description="Postings per week in each account’s strongest division"
          chart={<Heatmap compact rows={p.divisionWeeks.map((d) => `${d.name} · ${d.label}`)} cols={p.weeks} cells={p.divisionWeeks.map((d) => d.weeks)} unit="postings" label="Heatmap of weekly postings for the top 20 accounts" />}
          table={<DataTable caption="Weekly postings for the top 20 accounts" head={["Account · division", ...p.weeks]} rows={p.divisionWeeks.map((d) => [`${d.name} · ${d.label}`, ...d.weeks])} />}
        />
        <ChartCard
          title="Most-hired role families"
          description="Counted postings across all accounts"
          chart={<HBars data={p.families} x="roles" y="family" unit="roles" label="Bar chart of most-hired role families" />}
          table={<DataTable caption="Most-hired role families" head={["Role family", "Roles"]} rows={p.families.map((r) => [r.family, r.roles])} />}
        />
      </div>

      <section aria-labelledby="cl-list" className="space-y-3">
        <h2 id="cl-list" className="text-[14px] font-semibold">
          All clusters ({list.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search clusters" placeholder="Search" value={f.q} onChange={(e) => void setF({ q: e.target.value || null })} className="h-8 pl-8 text-[13px]" />
          </div>
          <Select aria-label="Region" value={f.region} onChange={(e) => void setF({ region: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any region</option>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select aria-label="Function" value={f.fn} onChange={(e) => void setF({ fn: e.target.value || null })} className="h-8 w-auto text-[13px]">
            <option value="">Any function</option>
            {[...new Set(p.rows.map((r) => r.function))].map((x) => (
              <option key={x} value={x}>
                {fnLabel(x)}
              </option>
            ))}
          </Select>
          <Select aria-label="Minimum index" value={String(f.min)} onChange={(e) => void setF({ min: Number(e.target.value) || null })} className="h-8 w-auto text-[13px]">
            <option value="0">Any index</option>
            <option value="30">Index ≥ 30</option>
            <option value="60">Index ≥ 60</option>
          </Select>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {list.map((r) => (
            <li key={`${r.companyId}:${r.key}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-hover">
              <TierPill tier={r.tier as Tier} />
              <div className="min-w-0 flex-1">
                <Link href={`/accounts/${r.companyId}`} className="block truncate text-[13px] font-semibold hover:underline">
                  {r.companyName}
                </Link>
                <div className="truncate text-[12px] text-muted">
                  {r.label}
                  {r.newLeader ? ` · new leader ${r.newLeader}` : ""}
                </div>
              </div>
              <span className="tabular text-[12px] text-muted">{r.openRoles} {r.openRoles === 1 ? "role" : "roles"}</span>
              <ScoreChip label="Hiring Cluster Index" value={r.index} factors={r.breakdown} note={r.label} className="w-10 text-[14px]" />
              <span className="hidden w-20 text-right text-[12px] text-muted sm:inline">{relativeTime(r.newestAt)}</span>
            </li>
          ))}
          {list.length === 0 ? <li className="px-4 py-6 text-center text-[13px] text-muted">No clusters match these filters.</li> : null}
        </ul>
      </section>
    </div>
  );
}
