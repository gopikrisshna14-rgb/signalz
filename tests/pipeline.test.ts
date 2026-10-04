import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResearch, advanceSimulations, markStuck } from "@/lib/pipeline/steps";
import { processScan } from "@/lib/pipeline/scan";
import { scanFixture } from "@/lib/pipeline/fixtures";
import { MemoryKv } from "@/lib/store/kv";
import { KvStore } from "@/lib/store/store";
import type { Scan } from "@/lib/types";

async function runToEnd(store: KvStore, orgId: string, id: string) {
  for (let i = 0; i < 20; i++) {
    const r = (await store.getResearch(id))!;
    if (r.status === "done" || r.status === "failed") return r;
    vi.advanceTimersByTime(2000);
    await advanceSimulations(store, await store.listResearch(orgId));
  }
  return (await store.getResearch(id))!;
}

describe("research pipeline (simulated)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("moves a person URL through every step to Done and builds a cluster", async () => {
    const store = new KvStore(new MemoryKv());
    const r = await createResearch(store, { orgId: "o1", userId: "u1", url: "https://www.linkedin.com/in/jonas-weber", kind: "person", simulated: true });
    expect(r.status).toBe("profile");
    const done = await runToEnd(store, "o1", r.id);
    expect(done.status).toBe("done");
    const company = (await store.getCompany(done.companyId!))!;
    expect(company.jobs.length).toBe(6);
    expect(company.jobs.find((j) => j.title.startsWith("Kassierer"))!.cls.isExcluded).toBe(true);
    expect(company.clusters[0].label).toBe("Sales · E-Commerce · DACH");
    expect(company.people[0].name).toBe("Jonas Weber");
    expect(company.score!.reasons.some((x) => x.startsWith("New sales leader"))).toBe(true);
    expect(done.personId).toBe(company.people[0].id);
    expect((await store.listSignals("o1")).length).toBeGreaterThan(0);
  });

  it("dedupes the company on a second research and keeps job ids", async () => {
    const store = new KvStore(new MemoryKv());
    const a = await runToEnd(store, "o1", (await createResearch(store, { orgId: "o1", userId: "u1", url: "https://www.linkedin.com/in/jonas-weber", kind: "person", simulated: true })).id);
    const first = (await store.getCompany(a.companyId!))!;
    const b = await runToEnd(store, "o1", (await createResearch(store, { orgId: "o1", userId: "u1", url: first.linkedinUrl!, kind: "company", simulated: true })).id);
    expect(b.companyId).toBe(a.companyId);
    const second = (await store.getCompany(b.companyId!))!;
    expect(second.jobs.map((j) => j.id).sort()).toEqual(first.jobs.map((j) => j.id).sort());
    expect(second.people.length).toBeGreaterThanOrEqual(first.people.length);
  });

  it("marks requests unchanged for 20 minutes as failed", async () => {
    const store = new KvStore(new MemoryKv());
    const r = await createResearch(store, { orgId: "o1", userId: "u1", url: "https://www.linkedin.com/in/x", kind: "person", simulated: true });
    await store.putResearch({ ...r, simulated: false, updatedAt: new Date(Date.now() - 21 * 60_000).toISOString() });
    expect(await markStuck(store, await store.listResearch("o1"))).toBe(1);
    expect((await store.getResearch(r.id))!.error).toMatch(/No answer from Apify/);
  });
});

describe("market scan", () => {
  it("groups by employer, skips recruiters and never closes jobs", async () => {
    const store = new KvStore(new MemoryKv());
    const scan: Scan = { id: "s1", orgId: "o1", searchId: null, name: "x", status: "running", startedAt: new Date().toISOString(), finishedAt: null, rawJobs: 0, companies: 0, hits: 0, costUsd: 0, error: null, simulated: true };
    const done = await processScan(store, scan, scanFixture(), 0.1);
    const companies = await store.listCompanies("o1");
    expect(companies.map((c) => c.name).sort()).toEqual(["Bergwerk Outdoor", "Kranwerk Logistics", "Lumenfeld AI"]);
    expect(done).toMatchObject({ status: "done", rawJobs: 8, companies: 3 });
    expect(done.hits).toBeGreaterThanOrEqual(2);
    await processScan(store, { ...scan, id: "s2" }, scanFixture().slice(0, 1), 0);
    const bergwerk = (await store.listCompanies("o1")).find((c) => c.name === "Bergwerk Outdoor")!;
    expect(bergwerk.jobs.every((j) => j.closedAt === null)).toBe(true);
  });
});
