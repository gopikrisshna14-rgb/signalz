import { notCountedReason } from "@/lib/scoring";
import { ANGLE_LABEL, ROLE_FAMILY_LABEL, type Angle, type Factor, type Company, type OutreachEvent, type OutreachType, type Settings, type Signal } from "@/lib/types";

const WEEK = 7 * 86_400_000;
const ANGLES = Object.keys(ANGLE_LABEL) as Angle[];

/* ------------------------------------------------------------------ */
/* Outreach                                                            */
/* ------------------------------------------------------------------ */

const STAGE: Record<OutreachType, number> = { connection_sent: 1, message_sent: 1, accepted: 2, replied: 3, meeting_booked: 4, not_interested: 3 };

/** One thread per company + person; a thread counts in every stage up to the furthest it reached. */
function threads(events: OutreachEvent[]) {
  const m = new Map<string, { angle: Angle | null; userId: string; userName: string; max: number; meeting: boolean }>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = `${e.companyId}:${e.personId ?? e.personName ?? ""}`;
    const t = m.get(key) ?? { angle: e.angle, userId: e.userId, userName: e.userName, max: 0, meeting: false };
    t.angle = t.angle ?? e.angle;
    t.max = Math.max(t.max, STAGE[e.type]);
    if (e.type === "meeting_booked") t.meeting = true;
    m.set(key, t);
  }
  return [...m.values()];
}

export interface FunnelRow {
  angle: Angle | "none";
  label: string;
  sent: number;
  accepted: number;
  replied: number;
  meeting: number;
}

export function funnelByAngle(events: OutreachEvent[]): FunnelRow[] {
  const ts = threads(events);
  const rows: FunnelRow[] = [...ANGLES, "none" as const].map((a) => {
    const list = ts.filter((t) => (t.angle ?? "none") === a);
    return {
      angle: a,
      label: a === "none" ? "No angle" : ANGLE_LABEL[a],
      sent: list.filter((t) => t.max >= 1).length,
      accepted: list.filter((t) => t.max >= 2).length,
      replied: list.filter((t) => t.max >= 3).length,
      meeting: list.filter((t) => t.meeting).length,
    };
  });
  return rows.filter((r) => r.sent > 0 || r.angle !== "none");
}

/** Replies by weekday (Mon=0) × hour in the viewer's time zone. */
export function replyHeatmap(events: OutreachEvent[], timeZone: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", hourCycle: "h23" });
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const e of events) {
    if (e.type !== "replied" && e.type !== "meeting_booked") continue;
    const parts = fmt.formatToParts(new Date(e.at));
    const d = days.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    if (d >= 0 && h >= 0 && h < 24) grid[d][h] += 1;
  }
  return grid;
}

export interface LeaderRow {
  userId: string;
  name: string;
  sent: number;
  accepted: number;
  replied: number;
  meetings: number;
  replyRate: number | null;
  steps: number;
}

export function leaderboard(events: OutreachEvent[]): LeaderRow[] {
  const ts = threads(events);
  const byUser = new Map<string, LeaderRow>();
  for (const t of ts) {
    const r = byUser.get(t.userId) ?? { userId: t.userId, name: t.userName, sent: 0, accepted: 0, replied: 0, meetings: 0, replyRate: null, steps: 0 };
    if (t.max >= 1) r.sent++;
    if (t.max >= 2) r.accepted++;
    if (t.max >= 3) r.replied++;
    if (t.meeting) r.meetings++;
    byUser.set(t.userId, r);
  }
  for (const e of events) {
    const r = byUser.get(e.userId);
    if (r) r.steps++;
  }
  return [...byUser.values()].map((r) => ({ ...r, replyRate: r.sent ? r.replied / r.sent : null })).sort((a, b) => b.meetings - a.meetings || b.replied - a.replied || b.sent - a.sent);
}

/* ------------------------------------------------------------------ */
/* Clusters                                                            */
/* ------------------------------------------------------------------ */

export interface ClusterRow {
  companyId: string;
  companyName: string;
  tier: string;
  key: string;
  label: string;
  function: string;
  businessUnit: string;
  region: string;
  openRoles: number;
  index: number;
  newLeader: string | null;
  newestAt: string | null;
  breakdown: Factor[];
}

export function clusterRows(companies: Company[]): ClusterRow[] {
  return companies
    .flatMap((c) =>
      c.clusters.map((cl) => ({
        companyId: c.id,
        companyName: c.name,
        tier: c.score?.tier ?? "cold",
        key: cl.key,
        label: cl.label,
        function: cl.function,
        businessUnit: cl.businessUnit,
        region: cl.region,
        openRoles: cl.openRoles,
        index: cl.index,
        newLeader: cl.newLeader ? `${cl.newLeader.name}, ${cl.newLeader.days} d` : null,
        newestAt: cl.newestAt,
        breakdown: cl.breakdown,
      })),
    )
    .sort((a, b) => b.index - a.index);
}

/** Open roles in active clusters by function × region. */
export function functionRegion(rows: ClusterRow[]) {
  const fns = [...new Set(rows.map((r) => r.function))].sort();
  const regions = [...new Set(rows.map((r) => r.region))].sort((a, b) => (a === "DACH" ? -1 : b === "DACH" ? 1 : a.localeCompare(b)));
  const cells = fns.map((f) => regions.map((g) => rows.filter((r) => r.function === f && r.region === g).reduce((a, r) => a + r.openRoles, 0)));
  return { rows: fns, cols: regions, cells };
}

function weekIndex(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / WEEK);
}

export function weekLabels(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * WEEK);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  });
}

/** Postings per week (12 weeks) for the top cluster of the top 20 accounts. */
export function divisionWeeks(companies: Company[], now = new Date()) {
  const top = [...companies].filter((c) => c.clusters.length).sort((a, b) => (b.score?.priority ?? 0) - (a.score?.priority ?? 0)).slice(0, 20);
  return top.map((c) => {
    const cl = c.clusters[0];
    const weeks = Array(12).fill(0) as number[];
    for (const j of c.jobs.filter((x) => cl.jobIds.includes(x.id))) {
      const w = weekIndex(j.postedAt ?? j.firstSeenAt, now);
      if (w >= 0 && w < 12) weeks[11 - w]++;
    }
    return { companyId: c.id, name: c.name, label: cl.label, weeks };
  });
}

/** New clusters per week: from hiring_cluster signals, falling back to cluster first-seen dates. */
export function newClustersPerWeek(signals: Signal[], companies: Company[], now = new Date()) {
  const counts = Array(12).fill(0) as number[];
  const seen = new Set<string>();
  for (const s of signals) {
    if (s.type !== "hiring_cluster") continue;
    const key = `${s.companyId}:${String(s.payload.clusterKey ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const w = weekIndex(s.at, now);
    if (w >= 0 && w < 12) counts[11 - w]++;
  }
  for (const c of companies)
    for (const cl of c.clusters) {
      if (seen.has(`${c.id}:${cl.key}`)) continue;
      const w = weekIndex(cl.firstSeenAt, now);
      if (w >= 0 && w < 12) counts[11 - w]++;
    }
  return weekLabels(12, now).map((week, i) => ({ week, clusters: counts[i] }));
}

export function roleFamilies(companies: Company[], settings: Settings, now = new Date()) {
  const m = new Map<string, number>();
  for (const c of companies) for (const j of c.jobs) if (notCountedReason(j, settings, now) === null) m.set(j.cls.roleFamily, (m.get(j.cls.roleFamily) ?? 0) + 1);
  return [...m.entries()].map(([k, n]) => ({ family: ROLE_FAMILY_LABEL[k as keyof typeof ROLE_FAMILY_LABEL] ?? k, roles: n })).sort((a, b) => b.roles - a.roles);
}
