import {
  CRM_LABEL,
  divisionKey,
  divisionLabel,
  divisionFunction,
  isCompetitorCrm,
} from "@/lib/pipeline/rules";
import type {
  AccountScore,
  Angle,
  Bucket,
  Cluster,
  Company,
  Division,
  Factor,
  Job,
  JobFlag,
  Person,
  Settings,
  Signal,
  Tier,
} from "@/lib/types";

const DAY = 86_400_000;

export function daysBetween(fromIso: string | null | undefined, now: Date): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

const clamp = (n: number, max = 100) => Math.max(0, Math.min(max, Math.round(n)));
const sum = (f: Factor[]) => f.reduce((a, b) => a + b.points, 0);

/* ------------------------------------------------------------------ */
/* Which postings count                                                */
/* ------------------------------------------------------------------ */

/** Returns why a posting is not counted towards a cluster, or null when it counts. */
export function notCountedReason(job: Job, settings: Settings, now: Date): string | null {
  if (job.closedAt) return "Closed or no longer listed";
  if (job.cls.isExcluded) return job.cls.exclusionReason ?? "Excluded role";
  if (!job.cls.employerIdentified) return "Recruiter or agency posting without a named employer";
  if (!settings.functions.includes(job.cls.function)) return `Function not targeted (${job.cls.function.replace("_", " ")})`;
  const age = daysBetween(job.postedAt ?? job.firstSeenAt, now);
  if (age !== null && age > settings.clusterWindowDays) return `Posted ${age} days ago (window ${settings.clusterWindowDays} days)`;
  return null;
}

export function isNewLeader(p: Person, settings: Settings, now: Date): boolean {
  if (p.cls.roleFamily !== "leader") return false;
  const d = daysBetween(p.roleStartedAt, now);
  return d !== null && d <= settings.leaderTenureDays;
}

const BUILD_FLAGS: JobFlag[] = ["first_sdr", "founding_team", "build_from_scratch"];

/* ------------------------------------------------------------------ */
/* Clusters                                                            */
/* ------------------------------------------------------------------ */

export function newRegionJobIds(company: Company, counted: Job[], settings: Settings, now: Date): Set<string> {
  const ids = new Set<string>();
  if (!company.country) return ids;
  for (const job of counted) {
    if (!job.country || job.country === company.country) continue;
    const hadBefore = company.jobs.some((o) => {
      if (o.id === job.id || o.country !== job.country) return false;
      const age = daysBetween(o.postedAt ?? o.firstSeenAt, now) ?? 0;
      return o.closedAt !== null || age > settings.clusterWindowDays;
    });
    if (!hadBefore) ids.add(job.id);
  }
  return ids;
}

export function clusterIndex(input: {
  openRoles: number;
  sdrAe: number;
  leaderRoles: number;
  revops: number;
  newLeaderDays: number | null;
  leaderTenureDays: number;
  crmMentions: string[];
  ownProduct: string;
  flags: JobFlag[];
  velocity14: number;
}): { index: number; breakdown: Factor[] } {
  const f: Factor[] = [];
  const roles = Math.min(45, input.openRoles * 15);
  if (roles) f.push({ label: `${input.openRoles} open role${input.openRoles === 1 ? "" : "s"} (15 each, max 45)`, points: roles });
  const hasLeader = input.leaderRoles > 0 || input.newLeaderDays !== null;
  if (hasLeader && input.sdrAe >= 1) f.push({ label: "Leader + SDR/AE mix", points: 20 });
  else if (input.sdrAe >= 2) f.push({ label: `${input.sdrAe} SDR/AE roles`, points: 10 });
  if (input.newLeaderDays !== null) {
    const d = input.newLeaderDays;
    const pts = d <= 30 ? 20 : d <= 60 ? 15 : d <= input.leaderTenureDays ? 10 : 0;
    if (pts) f.push({ label: `New leader, ${d} days in`, points: pts });
  }
  const competitors = input.crmMentions.filter((c) => isCompetitorCrm(c, input.ownProduct));
  if (competitors.length) f.push({ label: `Competitor CRM in ads (${competitors.map((c) => CRM_LABEL[c] ?? c).join(", ")})`, points: 10 });
  else if (input.crmMentions.includes(input.ownProduct)) f.push({ label: `${CRM_LABEL[input.ownProduct] ?? input.ownProduct} in ads`, points: 5 });
  const flag = input.flags.find((x) => x !== "reposted");
  if (flag) f.push({ label: FLAG_LABEL[flag], points: 10 });
  if (input.velocity14 >= 2) f.push({ label: `${input.velocity14} roles posted in the last 14 days`, points: 5 });
  if (input.revops > 0) f.push({ label: "RevOps / enablement role", points: 5 });
  return { index: clamp(sum(f)), breakdown: f };
}

export const FLAG_LABEL: Record<JobFlag, string> = {
  first_sdr: "First SDR / first sales hire",
  founding_team: "Founding sales team",
  build_from_scratch: "Building the team from scratch",
  new_region: "Sales roles in a new region",
  reposted: "Reposted role",
};

export function computeClusters(company: Company, settings: Settings, now: Date): { divisions: Division[]; clusters: Cluster[] } {
  const counted = company.jobs.filter((j) => notCountedReason(j, settings, now) === null);
  const newRegion = newRegionJobIds(company, counted, settings, now);

  const divisions = new Map<string, Division>();
  for (const j of company.jobs) {
    if (j.cls.isExcluded) continue;
    const key = divisionKey(j.cls.function, j.cls.businessUnit, j.cls.region);
    if (!divisions.has(key))
      divisions.set(key, {
        key,
        label: divisionLabel(j.cls.function, j.cls.businessUnit, j.cls.region),
        function: divisionFunction(j.cls.function),
        businessUnit: j.cls.businessUnit,
        region: j.cls.region,
      });
  }

  const groups = new Map<string, Job[]>();
  for (const j of counted) {
    const key = divisionKey(j.cls.function, j.cls.businessUnit, j.cls.region);
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }

  // Attach each new leader to their own division, else to the biggest sales group.
  const leaders = company.people.filter((p) => isNewLeader(p, settings, now));
  const leaderOf = new Map<string, Person>();
  const biggest = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  for (const p of leaders) {
    const key = p.cls.divisionKey && groups.has(p.cls.divisionKey) ? p.cls.divisionKey : biggest;
    if (!key) continue;
    const current = leaderOf.get(key);
    if (!current || (daysBetween(p.roleStartedAt, now) ?? 999) < (daysBetween(current.roleStartedAt, now) ?? 999)) leaderOf.set(key, p);
  }

  const clusters: Cluster[] = [];
  for (const [key, jobs] of groups) {
    const leader = leaderOf.get(key) ?? null;
    const flags = new Set<JobFlag>();
    for (const j of jobs) for (const fl of j.cls.flags) flags.add(fl);
    if (jobs.some((j) => newRegion.has(j.id))) flags.add("new_region");
    const forms =
      jobs.length >= settings.minClusterRoles || (leader !== null && jobs.length >= 1) || jobs.some((j) => j.cls.flags.some((x) => BUILD_FLAGS.includes(x)));
    if (!forms) continue;

    const sdrAe = jobs.filter((j) => j.cls.roleFamily === "sdr" || j.cls.roleFamily === "ae").length;
    const leaderRoles = jobs.filter((j) => j.cls.roleFamily === "leader").length;
    const revops = jobs.filter((j) => j.cls.roleFamily === "revops").length;
    const crm = [...new Set(jobs.flatMap((j) => j.cls.crmMentions))];
    const velocity14 = jobs.filter((j) => (daysBetween(j.postedAt ?? j.firstSeenAt, now) ?? 99) <= 14).length;
    const leaderDays = leader ? daysBetween(leader.roleStartedAt, now) : null;
    const { index, breakdown } = clusterIndex({
      openRoles: jobs.length,
      sdrAe,
      leaderRoles,
      revops,
      newLeaderDays: leaderDays,
      leaderTenureDays: settings.leaderTenureDays,
      crmMentions: crm,
      ownProduct: settings.ownProduct,
      flags: [...flags],
      velocity14,
    });
    const dates = jobs.map((j) => j.postedAt ?? j.firstSeenAt).filter(Boolean) as string[];
    if (leader?.roleStartedAt) dates.push(leader.roleStartedAt);
    const first = jobs.map((j) => j.firstSeenAt).sort()[0] ?? now.toISOString();
    const div = divisions.get(key)!;
    clusters.push({
      key,
      label: div.label,
      function: div.function,
      businessUnit: div.businessUnit,
      region: div.region,
      jobIds: jobs.map((j) => j.id),
      openRoles: jobs.length,
      sdrAe,
      leaders: leaderRoles,
      revops,
      newLeader: leader && leaderDays !== null ? { personId: leader.id, name: leader.name, days: leaderDays } : null,
      crmMentions: crm,
      flags: [...flags],
      velocity14,
      index,
      breakdown,
      newestAt: dates.sort().at(-1) ?? null,
      firstSeenAt: first,
    });
  }
  clusters.sort((a, b) => b.index - a.index || b.openRoles - a.openRoles);
  return { divisions: [...divisions.values()], clusters };
}

/* ------------------------------------------------------------------ */
/* Account scores                                                      */
/* ------------------------------------------------------------------ */

export function crmState(company: Company, settings: Settings): { state: AccountScore["crmState"]; named: string[] } {
  const named = new Set(company.jobs.filter((j) => !j.cls.isExcluded).flatMap((j) => j.cls.crmMentions));
  if (company.crm.detected && company.crm.detected !== "none") named.add(company.crm.detected);
  const list = [...named];
  if (list.includes(settings.ownProduct)) return { state: "own", named: list };
  if (list.some((c) => isCompetitorCrm(c, settings.ownProduct))) return { state: "competitor", named: list };
  if (list.includes("spreadsheet")) return { state: "spreadsheet", named: list };
  if (company.crm.detected === "none") return { state: "none", named: list };
  return { state: "unknown", named: list };
}

export function fitScore(company: Company, settings: Settings, crm: AccountScore["crmState"]): { score: number; factors: Factor[] } {
  const f: Factor[] = [];
  const hc = company.headcount;
  if (hc === null) f.push({ label: "Headcount unknown", points: 10 });
  else if (hc >= settings.headcountMin && hc <= settings.headcountMax)
    f.push({ label: `${hc.toLocaleString("en")} employees, in band ${settings.headcountMin}–${settings.headcountMax}`, points: 35 });
  else if (hc >= settings.headcountMin / 2 && hc <= settings.headcountMax * 2) f.push({ label: `${hc.toLocaleString("en")} employees, near the band`, points: 15 });
  else f.push({ label: `${hc.toLocaleString("en")} employees, outside the band`, points: 0 });

  if (!company.country) f.push({ label: "Country unknown", points: 10 });
  else if (settings.countries.includes(company.country)) f.push({ label: `Based in ${company.country}`, points: 25 });
  else f.push({ label: `Based in ${company.country}, not a target country`, points: 0 });

  if (settings.industries.length === 0) f.push({ label: "Any industry", points: 15 });
  else if (company.industry && settings.industries.some((i) => company.industry!.toLowerCase().includes(i.toLowerCase())))
    f.push({ label: `Target industry (${company.industry})`, points: 15 });
  else f.push({ label: company.industry ? `Industry ${company.industry} not targeted` : "Industry unknown", points: 0 });

  const crmPoints = { none: 15, spreadsheet: 15, competitor: 10, unknown: 8, own: 0 }[crm];
  const crmLabel = {
    none: "No CRM yet",
    spreadsheet: "Runs sales on spreadsheets",
    competitor: "Uses a competitor CRM",
    unknown: "CRM unknown",
    own: `Already uses ${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct}`,
  }[crm];
  f.push({ label: crmLabel, points: crmPoints });

  const g = company.headcountGrowth6m;
  if (g !== null && g >= 0.1) f.push({ label: `Headcount +${Math.round(g * 100)} % in 6 months`, points: 10 });
  else if (g !== null && g >= 0) f.push({ label: `Headcount +${Math.round(g * 100)} % in 6 months`, points: 5 });
  return { score: clamp(sum(f)), factors: f };
}

/** Economic buyer (new sales leader) first, then the RevOps hire, then the hiring manager. */
export function pickDecisionMaker(people: Person[], settings: Settings, now: Date): Person | null {
  const rank = (p: Person) => {
    if (isNewLeader(p, settings, now)) return 0;
    if (p.cls.isDecisionMaker && p.cls.roleFamily === "leader") return 1;
    if (p.cls.roleFamily === "revops") return 2;
    if (p.cls.persona === "Hiring manager") return 3;
    if (p.cls.isDecisionMaker) return 4;
    return 5;
  };
  return [...people].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export function reachScore(dm: Person | null, settings: Settings, now: Date): { score: number; factors: Factor[] } {
  const f: Factor[] = [];
  if (!dm) return { score: 10, factors: [{ label: "No decision maker found yet", points: 10 }] };
  f.push({ label: `Decision maker found (${dm.name})`, points: 30 });
  const lastPost = dm.posts.map((p) => daysBetween(p.at, now)).filter((d): d is number => d !== null).sort((a, b) => a - b)[0];
  if (lastPost !== undefined && lastPost <= 30) f.push({ label: `Posted on LinkedIn ${lastPost} days ago`, points: 20 });
  const m = dm.mutualConnections ?? 0;
  if (m >= 5) f.push({ label: `${m} mutual connections`, points: 20 });
  else if (m > 0) f.push({ label: `${m} mutual connection${m === 1 ? "" : "s"}`, points: 15 });
  if (dm.cls.priorTools.includes(settings.ownProduct)) f.push({ label: `Used ${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct} before`, points: 20 });
  if (dm.sharedHistory) f.push({ label: `Shared history: ${dm.sharedHistory}`, points: 10 });
  if (dm.email) f.push({ label: "E-mail known", points: 5 });
  return { score: clamp(sum(f)), factors: f };
}

export function timingScore(newestIso: string | null, now: Date): { score: number; factors: Factor[]; days: number | null } {
  const d = daysBetween(newestIso, now);
  if (d === null) return { score: 0, factors: [{ label: "No recent posting or leader change", points: 0 }], days: null };
  const score = clamp(100 * Math.exp(-d / 30));
  return { score, factors: [{ label: `Newest signal ${d} day${d === 1 ? "" : "s"} ago (100·e^(−d/30))`, points: score }], days: d };
}

export function tierFor(priority: number, settings: Settings): Tier {
  if (priority >= settings.hotThreshold) return "hot";
  if (priority >= settings.warmThreshold) return "warm";
  return "cold";
}

export function bucketFor(input: {
  routed: boolean;
  lastOutreachAt: string | null;
  status: Company["status"];
  cluster: number;
  fit: number;
  exported: boolean;
  priority: number;
  warmThreshold: number;
  now: Date;
}): Bucket {
  if (input.routed) return "routed";
  const since = daysBetween(input.lastOutreachAt, input.now);
  if (since !== null && since <= 14) return "recently_contacted";
  if (input.status !== "prospect") return "other";
  if (input.cluster >= 60 && input.fit >= 60) return "call_today";
  if (input.cluster >= 60) return "high_intent";
  if (!input.exported && input.priority >= input.warmThreshold) return "net_new";
  if (input.cluster >= 30) return "warming_up";
  return "other";
}

export function angleFor(input: { newLeader: boolean; sdrAe: number; competitorCrm: boolean; newRegion: boolean }): Angle {
  if (input.newLeader) return "first_90_days";
  if (input.sdrAe >= 2) return "team_buildout";
  if (input.competitorCrm) return "crm_displacement";
  if (input.newRegion) return "expansion";
  return "team_buildout";
}

export function clusterReason(c: Cluster): string {
  const parts: string[] = [];
  if (c.sdrAe) parts.push(`${c.sdrAe} SDR/AE`);
  if (c.leaders) parts.push(`${c.leaders} leader`);
  if (c.revops) parts.push(`${c.revops} RevOps`);
  const other = c.openRoles - c.sdrAe - c.leaders - c.revops;
  if (other > 0) parts.push(`${other} other`);
  return `${c.openRoles} open role${c.openRoles === 1 ? "" : "s"} in ${c.label}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

export function computeScore(company: Company, clusters: Cluster[], settings: Settings, now: Date): AccountScore {
  const top = clusters[0] ?? null;
  const counted = company.jobs.filter((j) => notCountedReason(j, settings, now) === null);
  const crm = crmState(company, settings);
  const fit = fitScore(company, settings, crm.state);
  const dm = pickDecisionMaker(company.people, settings, now);
  const reach = reachScore(dm, settings, now);

  const newLeaders = company.people
    .filter((p) => isNewLeader(p, settings, now))
    .sort((a, b) => (daysBetween(a.roleStartedAt, now) ?? 0) - (daysBetween(b.roleStartedAt, now) ?? 0));
  const leader = newLeaders[0] ?? null;
  const dates = counted.map((j) => j.postedAt ?? j.firstSeenAt);
  if (leader?.roleStartedAt) dates.push(leader.roleStartedAt);
  const timing = timingScore(dates.sort().at(-1) ?? null, now);

  // Boosters raise priority only.
  const boost: Factor[] = [];
  const fundingDays = daysBetween(company.fundingAt, now);
  if (fundingDays !== null && fundingDays <= 183) boost.push({ label: `Funding ${Math.round(fundingDays / 30)} months ago`, points: 5 });
  if ((company.headcountGrowth6m ?? 0) >= 0.1) boost.push({ label: "Headcount growth ≥ 10 %", points: 3 });
  const dmPost = dm?.posts.some((p) => (daysBetween(p.at, now) ?? 99) <= 30);
  if (dmPost) boost.push({ label: "Decision maker posted in the last 30 days", points: 2 });
  if (dm?.cls.priorTools.includes(settings.ownProduct)) boost.push({ label: `Decision maker used ${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct} before`, points: 3 });
  const stale = counted.some((j) => j.cls.flags.includes("reposted")) || company.jobs.some((j) => !j.closedAt && !j.cls.isExcluded && (daysBetween(j.postedAt, now) ?? 0) > 45);
  if (stale) boost.push({ label: "Roles reposted or open > 45 days", points: 2 });

  const clusterScore = top?.index ?? 0;
  const w = settings.weights;
  const weighted = w.cluster * clusterScore + w.fit * fit.score + w.timing * timing.score + w.reach * reach.score;
  const priority = clamp(weighted + sum(boost));
  const tier = tierFor(priority, settings);

  const routed = company.routedTo !== null || crm.state === "own";
  const bucket = bucketFor({
    routed,
    lastOutreachAt: company.lastOutreachAt,
    status: company.status,
    cluster: clusterScore,
    fit: fit.score,
    exported: Boolean(company.crm.exportedAt || company.crm.hubspotCompanyId),
    priority,
    warmThreshold: settings.warmThreshold,
    now,
  });

  const suppression: string[] = [];
  if (company.status === "customer") suppression.push("Customer");
  if (company.status === "open_opportunity") suppression.push("Open opportunity");
  if (company.status === "disqualified") suppression.push("Disqualified");
  if (routed) suppression.push(company.routedTo ?? `Existing customer (${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct} detected)`);
  const since = daysBetween(company.lastOutreachAt, now);
  if (since !== null && since <= 14) suppression.push(`Contacted ${since === 0 ? "today" : `${since} days ago`}`);

  const reasons: string[] = [];
  if (top) reasons.push(clusterReason(top));
  if (leader) reasons.push(`New sales leader, ${daysBetween(leader.roleStartedAt, now)} days in the role`);
  for (const c of clusters.slice(1, 3)) reasons.push(`Also hiring in ${c.label} (${c.openRoles} role${c.openRoles === 1 ? "" : "s"})`);
  const allFlags = new Set(clusters.flatMap((c) => c.flags));
  if (allFlags.has("build_from_scratch") || allFlags.has("founding_team")) reasons.push("Building the sales team from scratch");
  if (allFlags.has("first_sdr")) reasons.push("Hiring the first SDR");
  const newRegionCluster = clusters.find((c) => c.flags.includes("new_region"));
  if (newRegionCluster) {
    const countries = [
      ...new Set(company.jobs.filter((j) => newRegionCluster.jobIds.includes(j.id) && j.country && j.country !== company.country).map((j) => j.country)),
    ];
    reasons.push(`Sales roles in a new country (${countries.join(", ") || newRegionCluster.region})`);
  }
  const competitors = crm.named.filter((c) => isCompetitorCrm(c, settings.ownProduct));
  if (competitors.length) reasons.push(`Job ads mention ${competitors.map((c) => CRM_LABEL[c] ?? c).join(", ")}`);
  else if (crm.state === "spreadsheet") reasons.push("Job ads mention spreadsheets (greenfield)");
  if (dm?.cls.priorTools.includes(settings.ownProduct)) reasons.push(`${dm.name} used ${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct} before`);
  const g = company.headcountGrowth6m;
  if (g !== null && g >= 0.1) reasons.push(`Headcount +${Math.round(g * 100)} % in 6 months`);
  if (fundingDays !== null && fundingDays <= 183) reasons.push(`Raised funding ${Math.max(1, Math.round(fundingDays / 30))} months ago`);
  if (dmPost && dm) reasons.push(`${dm.name} posted on LinkedIn in the last 30 days`);
  if (stale) reasons.push("Roles reposted or open > 45 days");

  return {
    cluster: clusterScore,
    fit: fit.score,
    timing: timing.score,
    reach: reach.score,
    boost: sum(boost),
    priority,
    tier,
    bucket,
    reasons,
    breakdown: { cluster: top?.breakdown ?? [], fit: fit.factors, timing: timing.factors, reach: reach.factors, boost },
    topClusterKey: top?.key ?? null,
    decisionMakerId: dm?.id ?? null,
    angle: angleFor({
      newLeader: leader !== null,
      sdrAe: top?.sdrAe ?? 0,
      competitorCrm: competitors.length > 0,
      newRegion: Boolean(newRegionCluster),
    }),
    suppression,
    crmState: crm.state,
    crmNamed: crm.named,
    computedAt: now.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Recompute + signals                                                 */
/* ------------------------------------------------------------------ */

export type NewSignal = Omit<Signal, "id">;

export function diffSignals(prev: Company | null, next: Company, settings: Settings, now: Date): NewSignal[] {
  const at = now.toISOString();
  const base = { companyId: next.id, companyName: next.name, at };
  const out: NewSignal[] = [];
  const prevClusters = new Map((prev?.clusters ?? []).map((c) => [c.key, c]));
  for (const c of next.clusters) {
    const before = prevClusters.get(c.key);
    if (!before) out.push({ ...base, type: "hiring_cluster", title: `New hiring cluster: ${clusterReason(c)}`, strength: c.index, payload: { clusterKey: c.key } });
    else if (c.openRoles > before.openRoles)
      out.push({ ...base, type: "cluster_grew", title: `${c.label} grew from ${before.openRoles} to ${c.openRoles} open roles`, strength: c.index, payload: { clusterKey: c.key } });
  }
  const prevLeaders = new Set((prev?.people ?? []).filter((p) => isNewLeader(p, settings, now)).map((p) => p.id));
  for (const p of next.people.filter((x) => isNewLeader(x, settings, now) && !prevLeaders.has(x.id)))
    out.push({ ...base, type: "new_sales_leader", title: `New sales leader: ${p.name} (${p.title}), ${daysBetween(p.roleStartedAt, now)} days in`, strength: 80, payload: { personId: p.id } });
  const prevFirst = new Set((prev?.jobs ?? []).filter((j) => j.cls.flags.some((f) => BUILD_FLAGS.includes(f))).map((j) => j.id));
  for (const j of next.jobs.filter((x) => !x.closedAt && !x.cls.isExcluded && x.cls.flags.some((f) => BUILD_FLAGS.includes(f)) && !prevFirst.has(x.id)))
    out.push({ ...base, type: "first_sdr", title: `Building from scratch: “${j.title}”`, strength: 70, payload: { jobId: j.id } });
  const order: Record<Tier, number> = { cold: 0, warm: 1, hot: 2 };
  const before = prev?.score?.tier;
  const after = next.score?.tier;
  if (before && after && order[after] > order[before]) {
    const dm = next.people.find((p) => p.id === next.score?.decisionMakerId);
    out.push({
      ...base,
      type: "tier_changed",
      title: `${cap(before)} → ${cap(after)}`,
      strength: next.score?.priority ?? 0,
      payload: { from: before, to: after, person: dm?.name ?? null },
    });
  }
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Recomputes divisions, clusters, score and score history. Pure: returns a new company. */
export function recompute(company: Company, settings: Settings, now = new Date()): { company: Company; signals: NewSignal[] } {
  const { divisions, clusters } = computeClusters(company, settings, now);
  const draft: Company = { ...company, divisions, clusters };
  const score = computeScore(draft, clusters, settings, now);
  const history = [...company.scoreHistory];
  const last = history.at(-1);
  if (!last || last.priority !== score.priority || last.tier !== score.tier || now.getTime() - Date.parse(last.at) > 12 * 3600_000)
    history.push({ at: now.toISOString(), priority: score.priority, tier: score.tier });
  const next: Company = { ...draft, score, scoreHistory: history.slice(-30) };
  return { company: next, signals: diffSignals(company.score ? company : null, next, settings, now) };
}

/** Priority change over the last `days` days, from the score history. */
export function trendDelta(company: Company, days: number, now = new Date()): number {
  const cutoff = now.getTime() - days * DAY;
  const past = [...company.scoreHistory].reverse().find((h) => Date.parse(h.at) <= cutoff) ?? company.scoreHistory[0];
  if (!past || !company.score) return 0;
  return company.score.priority - past.priority;
}
