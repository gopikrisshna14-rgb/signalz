import "server-only";
import { newId } from "@/lib/ids";
import { isNewLeader, notCountedReason, recompute, trendDelta } from "@/lib/scoring";
import type { Store } from "@/lib/store/store";
import type { Bucket, Company, Settings, Signal, Tier } from "@/lib/types";

/**
 * The beta reads all companies of a workspace into memory (fine up to ~2,000 accounts).
 * This is the one place to replace with a real query later.
 */
export async function loadCompanies(store: Store, orgId: string): Promise<Company[]> {
  return store.listCompanies(orgId);
}

/** Recomputes clusters and scores, saves the company, and appends the new signals to the feed. */
export async function recomputeAndSave(store: Store, company: Company, settings: Settings, now = new Date()): Promise<{ company: Company; signals: Signal[] }> {
  const { company: next, signals } = recompute(company, settings, now);
  const saved: Company = { ...next, updatedAt: now.toISOString() };
  await store.putCompany(saved);
  const withIds = signals.map((s) => ({ ...s, id: newId("sig") }));
  await store.addSignals(company.orgId, withIds.reverse());
  return { company: saved, signals: withIds };
}

export interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
  headcount: number | null;
  country: string | null;
  industry: string | null;
  tier: Tier;
  bucket: Bucket;
  priority: number;
  cluster: number;
  fit: number;
  timing: number;
  reach: number;
  boost: number;
  breakdown: NonNullable<Company["score"]>["breakdown"];
  topReason: string | null;
  reasons: string[];
  division: string | null;
  openRoles: number;
  functions: string[];
  owner: { userId: string; name: string } | null;
  contact: { id: string; name: string; title: string; linkedinUrl: string | null } | null;
  lastSignalAt: string | null;
  change: "new" | "upgraded" | null;
  newLeader: boolean;
  trend7: number;
}

export function toRow(c: Company, settings: Settings, recentSignals: Map<string, Signal[]>, now = new Date()): AccountRow {
  const s = c.score!;
  const top = c.clusters[0] ?? null;
  const dm = c.people.find((p) => p.id === s.decisionMakerId) ?? null;
  const sigs = recentSignals.get(c.id) ?? [];
  const day = now.getTime() - 86_400_000;
  const recent = sigs.filter((x) => Date.parse(x.at) >= day);
  const change = Date.parse(c.createdAt) >= day || recent.some((x) => x.type === "hiring_cluster") ? "new" : recent.some((x) => x.type === "tier_changed" || x.type === "cluster_grew") ? "upgraded" : null;
  const lastJob = c.jobs
    .filter((j) => notCountedReason(j, settings, now) === null)
    .map((j) => j.postedAt ?? j.firstSeenAt)
    .sort()
    .at(-1);
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    logoUrl: c.logoUrl,
    linkedinUrl: c.linkedinUrl,
    headcount: c.headcount,
    country: c.country,
    industry: c.industry,
    tier: s.tier,
    bucket: s.bucket,
    priority: s.priority,
    cluster: s.cluster,
    fit: s.fit,
    timing: s.timing,
    reach: s.reach,
    boost: s.boost,
    breakdown: s.breakdown,
    topReason: s.reasons[0] ?? null,
    reasons: s.reasons,
    division: top?.label ?? null,
    openRoles: c.clusters.reduce((a, x) => a + x.openRoles, 0),
    functions: [...new Set(c.clusters.map((x) => x.function))],
    owner: c.owner ? { userId: c.owner.userId, name: c.owner.name } : null,
    contact: dm ? { id: dm.id, name: dm.name, title: dm.title, linkedinUrl: dm.linkedinUrl } : null,
    lastSignalAt: sigs[0]?.at ?? lastJob ?? null,
    change,
    newLeader: c.people.some((p) => isNewLeader(p, settings, now)),
    trend7: trendDelta(c, 7, now),
  };
}

export const KPI_KEYS = ["call_today", "net_new", "changed_24h", "new_leader", "routed"] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

export function kpis(rows: AccountRow[]): Record<KpiKey, number> {
  return {
    call_today: rows.filter((r) => r.bucket === "call_today").length,
    net_new: rows.filter((r) => r.bucket === "net_new").length,
    changed_24h: rows.filter((r) => r.change !== null).length,
    new_leader: rows.filter((r) => r.newLeader).length,
    routed: rows.filter((r) => r.bucket === "routed").length,
  };
}

export async function dashboardData(store: Store, orgId: string, now = new Date()) {
  const [companies, settings, signals] = await Promise.all([loadCompanies(store, orgId), store.getSettings(orgId), store.listSignals(orgId, 500)]);
  const byCompany = new Map<string, Signal[]>();
  for (const s of signals) byCompany.set(s.companyId, [...(byCompany.get(s.companyId) ?? []), s]);
  const rows = companies.filter((c) => c.score).map((c) => toRow(c, settings, byCompany, now));
  rows.sort((a, b) => b.priority - a.priority);
  const current = kpis(rows);

  // Daily snapshot for the 7-day deltas.
  const today = now.toISOString().slice(0, 10);
  const history = await store.getKpiHistory(orgId);
  if (!history[today] || JSON.stringify(history[today]) !== JSON.stringify(current)) await store.putKpiSnapshot(orgId, today, current);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const past = Object.keys(history)
    .filter((d) => d <= weekAgo)
    .sort()
    .at(-1);
  const deltas = Object.fromEntries(KPI_KEYS.map((k) => [k, past ? current[k] - (history[past][k] ?? 0) : null])) as Record<KpiKey, number | null>;

  const fresh = companies.map((c) => c.enrichedAt ?? c.updatedAt).sort().at(-1) ?? null;
  return { rows, kpis: current, deltas, feed: signals.slice(0, 40), freshAt: fresh, settings, total: companies.length, exportedAny: companies.some((c) => c.crm.exportedAt || c.crm.hubspotCompanyId) };
}
