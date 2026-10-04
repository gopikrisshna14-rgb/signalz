import { describe, expect, it } from "vitest";
import { buildDemoCompanies } from "@/lib/demo";
import { classifyJobByRules } from "@/lib/pipeline/rules";
import {
  bucketFor,
  clusterIndex,
  computeClusters,
  fitScore,
  notCountedReason,
  reachScore,
  recompute,
  timingScore,
  tierFor,
  angleFor,
} from "@/lib/scoring";
import type { Company, Job, Person } from "@/lib/types";
import { defaultSettings } from "@/lib/types";

const settings = defaultSettings();
const NOW = new Date("2026-10-04T12:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function job(title: string, days: number, extra: Partial<Job> = {}): Job {
  const location = extra.location ?? "Berlin, Germany";
  return {
    id: `j_${title}_${days}`,
    source: "linkedin",
    externalId: `${title}-${days}`,
    title,
    url: null,
    location,
    country: extra.country ?? "DE",
    city: "Berlin",
    description: extra.description ?? null,
    employerName: "Acme",
    postedAt: ago(days),
    firstSeenAt: ago(days),
    lastSeenAt: ago(0),
    closedAt: null,
    fromScan: false,
    cls: classifyJobByRules({ title, description: extra.description, location, employerName: "Acme" }, settings.exclusions),
    ...extra,
  };
}

function company(jobs: Job[], people: Person[] = [], extra: Partial<Company> = {}): Company {
  return {
    id: "c1",
    orgId: "o",
    name: "Acme",
    domain: "acme.de",
    linkedinUrl: null,
    linkedinId: null,
    logoUrl: null,
    industry: "Software",
    headcount: 300,
    headcountGrowth6m: 0.05,
    country: "DE",
    city: "Berlin",
    fundingAt: null,
    description: null,
    status: "prospect",
    routedTo: null,
    divisions: [],
    jobs,
    people,
    clusters: [],
    score: null,
    scoreHistory: [],
    owner: null,
    lastOutreachAt: null,
    crm: { detected: null, exportedAt: null, hubspotCompanyId: null, hubspotContactIds: {} },
    sources: [],
    enrichedAt: null,
    createdAt: ago(10),
    updatedAt: ago(0),
    ...extra,
  };
}

describe("demo sneaker brand (acceptance)", () => {
  const companies = buildDemoCompanies("o_test", settings, NOW);
  const laufwerk = companies.find((c) => c.name === "Laufwerk Sneakers")!;

  it("is #1 in Call today", () => {
    const callToday = companies.filter((c) => c.score!.bucket === "call_today").sort((a, b) => b.score!.priority - a.score!.priority);
    expect(callToday[0].name).toBe("Laufwerk Sneakers");
  });

  it("explains why now", () => {
    expect(laufwerk.score!.reasons).toContain("4 open roles in Sales · Wholesale · DACH (3 SDR/AE, 1 leader)");
    expect(laufwerk.score!.reasons).toContain("New sales leader, 21 days in the role");
    expect(laufwerk.score!.reasons[0]).toBe("4 open roles in Sales · Wholesale · DACH (3 SDR/AE, 1 leader)");
  });

  it("does not count the store job and still counts retail partnerships", () => {
    const store = laufwerk.jobs.find((j) => j.title === "Sales Associate, Store Berlin")!;
    expect(notCountedReason(store, settings, NOW)).toMatch(/exclusion/i);
    const counted = laufwerk.clusters.flatMap((c) => c.jobIds);
    expect(counted).not.toContain(store.id);
    const partnerships = laufwerk.jobs.find((j) => j.title === "Account Executive Retail Partnerships")!;
    expect(counted).toContain(partnerships.id);
  });

  it("gives two clusters for two divisions", () => {
    expect(laufwerk.clusters.map((c) => c.label)).toEqual(["Sales · Wholesale · DACH", "Sales · Retail Partnerships · DACH"]);
  });

  it("the excluded posting does not change the score", () => {
    const without = { ...laufwerk, jobs: laufwerk.jobs.filter((j) => !j.cls.isExcluded), score: null, clusters: [] };
    const a = recompute({ ...laufwerk, score: null, clusters: [] }, settings, NOW).company.score!;
    const b = recompute(without, settings, NOW).company.score!;
    expect(b.priority).toBe(a.priority);
    expect(b.cluster).toBe(a.cluster);
  });

  it("recommends the First 90 days angle", () => {
    expect(laufwerk.score!.angle).toBe("first_90_days");
  });
});

describe("clusters", () => {
  it("roles in different divisions never add up", () => {
    const c = company([job("SDR Wholesale DACH", 3), job("SDR Enterprise DACH", 4)]);
    const { clusters } = computeClusters(c, settings, NOW);
    expect(clusters).toHaveLength(0);
  });

  it("forms a cluster from min roles in one division", () => {
    const c = company([job("SDR Wholesale DACH", 3), job("Account Executive Wholesale DACH", 4)]);
    const { clusters } = computeClusters(c, settings, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].openRoles).toBe(2);
  });

  it("a first-SDR role alone forms a cluster", () => {
    const c = company([job("Our first SDR", 3)]);
    expect(computeClusters(c, settings, NOW).clusters).toHaveLength(1);
  });

  it("a new leader plus one open role forms a cluster", () => {
    const leader: Person = {
      id: "p1",
      name: "Jo Doe",
      firstName: "Jo",
      lastName: "Doe",
      title: "Head of Sales",
      linkedinUrl: null,
      email: null,
      location: "Berlin",
      country: "DE",
      roleStartedAt: ago(20),
      previousRoles: [],
      schools: [],
      posts: [],
      mutualConnections: null,
      sharedHistory: null,
      source: "test",
      scrapedAt: ago(0),
      cls: { roleFamily: "leader", seniority: "head", persona: "Economic buyer", isDecisionMaker: true, priorTools: [], divisionKey: null, by: "rules" },
    };
    const { clusters } = computeClusters(company([job("Account Executive", 5)], [leader]), settings, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].newLeader?.days).toBe(20);
  });

  it("ignores postings outside the window and recruiter postings", () => {
    const old = job("SDR Wholesale", 60);
    const agency = job("SDR Wholesale", 3, { description: "Für unseren Kunden suchen wir" });
    agency.cls = classifyJobByRules({ title: agency.title, description: agency.description, employerName: "Acme" }, settings.exclusions);
    expect(notCountedReason(old, settings, NOW)).toMatch(/window/);
    expect(notCountedReason(agency, settings, NOW)).toMatch(/Recruiter/);
  });
});

describe("cluster index", () => {
  it("adds up the documented points and caps at 100", () => {
    const r = clusterIndex({
      openRoles: 4,
      sdrAe: 3,
      leaderRoles: 1,
      revops: 1,
      newLeaderDays: 21,
      leaderTenureDays: 90,
      crmMentions: ["salesforce"],
      ownProduct: "hubspot",
      flags: ["build_from_scratch"],
      velocity14: 3,
    });
    expect(r.breakdown.map((f) => f.points)).toEqual([45, 20, 20, 10, 10, 5, 5]);
    expect(r.index).toBe(100);
  });

  it("scores roles, mix and leader tenure tiers", () => {
    const base = { leaderRoles: 0, revops: 0, leaderTenureDays: 90, crmMentions: [], ownProduct: "hubspot", flags: [], velocity14: 0 };
    expect(clusterIndex({ ...base, openRoles: 2, sdrAe: 2, newLeaderDays: null }).index).toBe(40);
    expect(clusterIndex({ ...base, openRoles: 1, sdrAe: 1, newLeaderDays: 45 }).index).toBe(15 + 20 + 15);
    expect(clusterIndex({ ...base, openRoles: 1, sdrAe: 0, newLeaderDays: 80 }).index).toBe(15 + 10);
    expect(clusterIndex({ ...base, openRoles: 1, sdrAe: 0, newLeaderDays: null, crmMentions: ["hubspot"] }).index).toBe(20);
  });
});

describe("account scores", () => {
  it("fit uses headcount band, country, industry, CRM and growth", () => {
    const c = company([]);
    expect(fitScore(c, settings, "competitor").score).toBe(35 + 25 + 15 + 10 + 5);
    expect(fitScore({ ...c, headcount: 30, country: "FR", headcountGrowth6m: 0.2 }, settings, "none").score).toBe(15 + 0 + 15 + 15 + 10);
    expect(fitScore({ ...c, headcount: null, country: null, headcountGrowth6m: null }, settings, "unknown").score).toBe(10 + 10 + 15 + 8);
    expect(fitScore(c, { ...settings, industries: ["Retail"] }, "own").score).toBe(35 + 25 + 0 + 0 + 5);
  });

  it("timing decays with 100·e^(−d/30)", () => {
    expect(timingScore(ago(0), NOW).score).toBe(100);
    expect(timingScore(ago(30), NOW).score).toBe(37);
    expect(timingScore(null, NOW).score).toBe(0);
  });

  it("reach caps at 100", () => {
    const dm = {
      name: "A B",
      email: "a@b.de",
      mutualConnections: 9,
      sharedHistory: "Same school",
      posts: [{ text: "x", at: ago(2), url: null }],
      cls: { priorTools: ["hubspot"] },
    } as unknown as Person;
    expect(reachScore(dm, settings, NOW).score).toBe(100);
    expect(reachScore(null, settings, NOW).score).toBe(10);
  });

  it("tiers", () => {
    expect(tierFor(70, settings)).toBe("hot");
    expect(tierFor(45, settings)).toBe("warm");
    expect(tierFor(44, settings)).toBe("cold");
  });

  it("buckets: first match wins", () => {
    const base = { routed: false, lastOutreachAt: null, status: "prospect" as const, cluster: 70, fit: 70, exported: false, priority: 80, warmThreshold: 45, now: NOW };
    expect(bucketFor({ ...base, routed: true, lastOutreachAt: ago(1) })).toBe("routed");
    expect(bucketFor({ ...base, lastOutreachAt: ago(3) })).toBe("recently_contacted");
    expect(bucketFor({ ...base, lastOutreachAt: ago(20) })).toBe("call_today");
    expect(bucketFor({ ...base, status: "customer" })).toBe("other");
    expect(bucketFor({ ...base, fit: 50 })).toBe("high_intent");
    expect(bucketFor({ ...base, cluster: 40, fit: 50 })).toBe("net_new");
    expect(bucketFor({ ...base, cluster: 40, exported: true })).toBe("warming_up");
    expect(bucketFor({ ...base, cluster: 10, priority: 20 })).toBe("other");
  });

  it("angles", () => {
    expect(angleFor({ newLeader: true, sdrAe: 3, competitorCrm: true, newRegion: true })).toBe("first_90_days");
    expect(angleFor({ newLeader: false, sdrAe: 2, competitorCrm: true, newRegion: true })).toBe("team_buildout");
    expect(angleFor({ newLeader: false, sdrAe: 1, competitorCrm: true, newRegion: true })).toBe("crm_displacement");
    expect(angleFor({ newLeader: false, sdrAe: 0, competitorCrm: false, newRegion: true })).toBe("expansion");
  });

  it("logging outreach moves the account to Recently contacted", () => {
    const laufwerk = buildDemoCompanies("o_test", settings, NOW)[0];
    const after = recompute({ ...laufwerk, lastOutreachAt: NOW.toISOString() }, settings, NOW).company;
    expect(after.score!.bucket).toBe("recently_contacted");
  });

  it("HubSpot in ads routes the account to Existing customer", () => {
    const c = recompute(company([job("SDR SMB", 3, { description: "HubSpot" }), job("AE SMB", 4)]), settings, NOW).company;
    expect(c.score!.bucket).toBe("routed");
  });
});

describe("signals", () => {
  it("emits new cluster, new leader and tier upgrades only", () => {
    const first = recompute(company([job("SDR Wholesale DACH", 3), job("Account Executive Wholesale DACH", 4)]), settings, NOW);
    expect(first.signals.map((s) => s.type)).toContain("hiring_cluster");
    const grown = recompute({ ...first.company, jobs: [...first.company.jobs, job("BDR Wholesale DACH", 1)] }, settings, NOW);
    expect(grown.signals.map((s) => s.type)).toContain("cluster_grew");
    const downgraded = recompute({ ...grown.company, jobs: [] }, settings, NOW);
    expect(downgraded.signals.find((s) => s.type === "tier_changed")).toBeUndefined();
  });
});
