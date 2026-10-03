"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, Gauge, Info, Layers, UserCheck, Users } from "lucide-react";
import { cn, relativeTime } from "@/lib/format";
import { sampleClusters, weekLabel, type ClustersData } from "@/lib/sample-data";
import { Card, Pill } from "@/components/ui";
import { BarList, ChartCard, ChartTooltip, DataSourceSwitch, Heatmap, StatTile } from "@/components/charts";

const FUNCTION_LABEL: Record<string, string> = {
  sales: "Sales",
  revops: "RevOps",
  marketing: "Marketing",
  customer_success: "Customer success",
  partnerships: "Partnerships",
  other: "Other",
};

function weeksBack(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  for (let i = n - 1; i >= 0; i--) {
    const w = new Date(d);
    w.setDate(d.getDate() - i * 7);
    out.push(w.toISOString().slice(0, 10));
  }
  return out;
}

export function ClustersView({ live }: { live: ClustersData }) {
  const liveAvailable = live.clusters.length > 0;
  // Until the n8n pipeline runs, the workspace has at most the 8 demo companies: show the fuller sample.
  const [mode, setMode] = useState<"live" | "sample">(live.clusters.length >= 10 ? "live" : "sample");
  const data = useMemo(() => (mode === "live" ? live : sampleClusters()), [mode, live]);
  const [fn, setFn] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const clusters = useMemo(
    () =>
      data.clusters
        .filter((c) => !fn || c.function === fn)
        .sort((a, b) => (sortDesc ? b.cluster_score - a.cluster_score : a.cluster_score - b.cluster_score)),
    [data.clusters, fn, sortDesc],
  );
  const openRoles = data.clusters.reduce((s, c) => s + c.open_roles, 0);
  const avg = data.clusters.length ? Math.round(data.clusters.reduce((s, c) => s + c.cluster_score, 0) / data.clusters.length) : 0;
  const withLeader = data.clusters.filter((c) => c.new_leader_days != null).length;

  const functions = [...new Set(data.functionRegion.map((r) => r.function))].sort(
    (a, b) =>
      data.functionRegion.filter((r) => r.function === b).reduce((s, r) => s + r.clusters, 0) -
      data.functionRegion.filter((r) => r.function === a).reduce((s, r) => s + r.clusters, 0),
  );
  const regions = [...new Set(data.functionRegion.map((r) => r.region))].sort(
    (a, b) =>
      data.functionRegion.filter((r) => r.region === b).reduce((s, r) => s + r.clusters, 0) -
      data.functionRegion.filter((r) => r.region === a).reduce((s, r) => s + r.clusters, 0),
  );
  const fr = new Map(data.functionRegion.map((r) => [`${r.function}|${r.region}`, r]));

  const weeks = weeksBack(12);
  const topDivisions = [...new Set(data.divisionWeek.map((r) => `${r.company}|${r.label}`))]
    .map((k) => ({ k, total: data.divisionWeek.filter((r) => `${r.company}|${r.label}` === k).reduce((s, r) => s + r.roles, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const dw = new Map<string, number>();
  for (const r of data.divisionWeek) {
    const k = `${r.company}|${r.label}|${r.week_start.slice(0, 10)}`;
    dw.set(k, (dw.get(k) ?? 0) + r.roles);
  }
  const perWeek = weeks.map((w) => ({ week: w, clusters: data.perWeek.find((p) => p.week.slice(0, 10) === w)?.clusters ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Clusters</h1>
          <p className="mt-0.5 text-[14px] text-muted">Where companies are building sales teams right now, one division at a time</p>
        </div>
        <DataSourceSwitch mode={mode} onChange={setMode} liveAvailable={liveAvailable} />
      </div>

      {mode === "sample" && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-accent-soft/60 px-3 py-2.5 text-[13px]">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <b>Sample data.</b> Once the n8n + Apify pipeline is connected, every researched company&apos;s clusters show up here.
            {liveAvailable && " Switch to Live data to see your current workspace."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active clusters" value={data.clusters.length} icon={<Layers size={15} />} tone="accent" />
        <StatTile label="Open sales roles" value={openRoles} icon={<Users size={15} />} tone="accent" />
        <StatTile label="Avg. cluster index" value={avg} icon={<Gauge size={15} />} tone="accent" hint="0–100" />
        <StatTile label="With a new leader" value={withLeader} icon={<UserCheck size={15} />} tone="hot" hint="first 90 days" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Function × region"
          subtitle="Number of hiring clusters · click a function to filter the list"
          className="lg:col-span-2"
          table={{
            head: ["Function", "Region", "Clusters", "Open roles", "Avg. index"],
            rows: data.functionRegion.map((r) => [FUNCTION_LABEL[r.function] ?? r.function, r.region, r.clusters, r.open_roles, r.avg_score]),
          }}
        >
          <Heatmap
            rows={functions.map((f) => ({ key: f, label: FUNCTION_LABEL[f] ?? f }))}
            cols={regions.map((r) => ({ key: r, label: r }))}
            value={(r, c) => fr.get(`${r}|${c}`)?.clusters ?? null}
            tooltip={(r, c, v) => {
              const e = fr.get(`${r}|${c}`);
              return e ? `${FUNCTION_LABEL[r] ?? r} · ${c}: ${v} clusters, ${e.open_roles} open roles, avg. index ${e.avg_score}` : `${FUNCTION_LABEL[r] ?? r} · ${c}: none`;
            }}
            cellLabel
            minCell={48}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {functions.map((f) => (
              <button
                key={f}
                onClick={() => setFn(fn === f ? "" : f)}
                aria-pressed={fn === f}
                className={cn(
                  "h-7 rounded-lg border px-2.5 text-[12px] font-medium",
                  fn === f ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-surface-2",
                )}
              >
                {FUNCTION_LABEL[f] ?? f}
              </button>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Most-hired roles"
          subtitle="Open postings, last 12 weeks"
          table={{ head: ["Role", "Postings"], rows: data.roleFamilies.map((r) => [r.role, r.count]) }}
        >
          <BarList items={data.roleFamilies.slice(0, 7).map((r) => ({ key: r.role, label: r.role, value: r.count }))} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="New clusters per week"
          subtitle="First detected"
          table={{ head: ["Week", "New clusters"], rows: perWeek.map((p) => [weekLabel(p.week), p.clusters]) }}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perWeek} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip format={weekLabel} />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="clusters" name="New clusters" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Hiring momentum"
          subtitle="Roles posted per week · top 10 divisions"
          className="lg:col-span-2"
          table={{
            head: ["Company", "Division", "Week", "Roles"],
            rows: data.divisionWeek.map((r) => [r.company, r.label, weekLabel(r.week_start), r.roles]),
          }}
        >
          {topDivisions.length === 0 ? (
            <p className="text-[13px] text-muted">No postings yet.</p>
          ) : (
            <Heatmap
              rows={topDivisions.map(({ k }) => {
                const [company, label] = k.split("|");
                return { key: k, label: `${company} · ${label!.split(" · ").slice(1).join(" · ") || label}` };
              })}
              cols={weeks.map((w, i) => ({ key: w, label: i % 3 === 2 ? weekLabel(w) : "" }))}
              value={(r, c) => dw.get(`${r}|${c}`) ?? null}
              tooltip={(r, c, v) => `${r.replace("|", " · ")} · week of ${weekLabel(c)}: ${v ?? 0} roles`}
              minCell={18}
            />
          )}
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <h2 className="text-[14px] font-semibold">All clusters</h2>
            <p className="text-[12px] text-muted">
              {clusters.length} clusters{fn ? ` in ${FUNCTION_LABEL[fn] ?? fn}` : ""}
            </p>
          </div>
          {fn && (
            <button onClick={() => setFn("")} className="text-[12px] text-accent hover:underline">
              Show all functions
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-y border-line text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Company · division</th>
                <th className="px-3 py-2.5 font-medium">Roles</th>
                <th className="px-3 py-2.5 font-medium">Leader</th>
                <th className="px-3 py-2.5 font-medium">CRM in ads</th>
                <th className="px-3 py-2.5 font-medium" aria-sort={sortDesc ? "descending" : "ascending"}>
                  <button onClick={() => setSortDesc((d) => !d)} className="inline-flex items-center gap-1 text-fg">
                    Index <ArrowDown size={12} className={cn(!sortDesc && "rotate-180")} />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => {
                const name = (
                  <>
                    <div className="font-medium">{c.company}</div>
                    <div className="text-[12px] text-muted">{c.division}</div>
                  </>
                );
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      {c.company_id && mode === "live" ? (
                        <Link href={`/accounts/${c.company_id}`} className="block hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.builder_roles > 0 && <Pill className="bg-accent-soft text-accent">SDR/AE ×{c.builder_roles}</Pill>}
                        {c.leader_roles > 0 && <Pill className="bg-accent-soft text-accent">Leader</Pill>}
                        {c.revops_roles > 0 && <Pill>RevOps ×{c.revops_roles}</Pill>}
                        {c.open_roles - c.builder_roles - c.leader_roles - c.revops_roles > 0 && (
                          <Pill>Other ×{c.open_roles - c.builder_roles - c.leader_roles - c.revops_roles}</Pill>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px]">
                      {c.new_leader_days != null ? <span className="font-medium">{c.new_leader_days} d in role</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[12px]">{c.crm_mentions.length ? c.crm_mentions.join(", ") : <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="tabular w-6 text-right font-semibold">{c.cluster_score}</span>
                        <div className="h-1.5 w-16 rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-chart-1" style={{ width: `${c.cluster_score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted">{relativeTime(c.first_detected_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
