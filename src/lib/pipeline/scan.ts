import "server-only";
import { newId } from "@/lib/ids";
import { actorId, actorInput, datasetItems, getRun, startRun } from "@/lib/pipeline/apify";
import { classifyJobs } from "@/lib/pipeline/classify";
import { scanFixture } from "@/lib/pipeline/fixtures";
import { employerKey, mapJob, type JobDraft } from "@/lib/pipeline/mappers";
import { mergeCompany } from "@/lib/pipeline/merge";
import { callbackUrl } from "@/lib/pipeline/steps";
import type { Store } from "@/lib/store/store";
import type { JobClassification, SavedSearch, Scan } from "@/lib/types";

export function scanSearchUrl(s: SavedSearch): string {
  const qs = new URLSearchParams({ keywords: s.keywords, location: s.location, f_TPR: `r${s.days * 86400}` });
  return `https://www.linkedin.com/jobs/search/?${qs}`;
}

/** Starts a market scan: the jobs actor on a saved search, then the same callback with scan=<id>. */
export async function startScan(store: Store, orgId: string, search: SavedSearch, opts: { simulate: boolean }): Promise<Scan> {
  const scan: Scan = {
    id: newId("scan"),
    orgId,
    searchId: search.id,
    name: `${search.keywords} · ${search.location} · ${search.days} days`,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    rawJobs: 0,
    companies: 0,
    hits: 0,
    costUsd: 0,
    error: null,
    simulated: opts.simulate,
  };
  await store.putScan(scan);
  if (opts.simulate) return processScan(store, scan, scanFixture(), 0);
  const actor = actorId("jobs");
  try {
    if (!actor) throw new Error("No jobs actor configured");
    await startRun(actor, actorInput("jobs", { url: scanSearchUrl(search), keywords: search.keywords, location: search.location, days: search.days, max: 200 }), callbackUrl(scan.id, "scan", "scan"));
    return scan;
  } catch (e) {
    const failed = { ...scan, status: "failed" as const, error: e instanceof Error ? e.message : String(e), finishedAt: new Date().toISOString() };
    await store.putScan(failed);
    return failed;
  }
}

/** Classify, group by employer, merge into companies. Never closes jobs; skips postings without a named employer. */
export async function processScan(store: Store, scan: Scan, items: Record<string, unknown>[], costUsd: number): Promise<Scan> {
  const settings = await store.getSettings(scan.orgId);
  await store.putScan({ ...scan, status: "classifying", rawJobs: items.length, costUsd });
  const drafts = items.map((x) => mapJob(x)).filter((j): j is JobDraft => j !== null);
  const { results } = await classifyJobs(
    drafts.map((d) => ({ title: d.title, description: d.description, location: d.location, country: d.country, employerName: d.employerName })),
    settings,
  );
  const groups = new Map<string, { draft: JobDraft; cls: JobClassification }[]>();
  drafts.forEach((draft, i) => {
    const cls = results[i];
    if (!cls.employerIdentified) return;
    const key = employerKey(draft);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), { draft, cls }]);
  });
  let companies = 0;
  let hits = 0;
  for (const [key, jobs] of groups) {
    if (!jobs.some((j) => !j.cls.isExcluded && settings.functions.includes(j.cls.function))) continue;
    const first = jobs[0].draft;
    const { company } = await mergeCompany(store, {
      orgId: scan.orgId,
      company: { name: first.employerName ?? "Unknown company", linkedinUrl: first.employerLinkedinUrl, domain: first.employerDomain },
      nameKey: key.startsWith("name:") ? key : null,
      jobs,
      jobSource: "linkedin",
      closeMissing: false,
      fromScan: true,
      sourceKind: "market scan",
    });
    companies++;
    if (company.clusters.length) hits++;
  }
  const done: Scan = { ...scan, status: "done", rawJobs: items.length, companies, hits, costUsd, finishedAt: new Date().toISOString() };
  await store.putScan(done);
  return done;
}

export async function handleScanCallback(store: Store, id: string, payload: { eventType?: string; resource?: { id?: string; statusMessage?: string; usageTotalUsd?: number } }) {
  return store.withCompanyLock(`scan:${id}`, async () => {
    const scan = await store.getScan(id);
    if (!scan || scan.status !== "running") return { ignored: "scan not running" };
    const runId = payload.resource?.id;
    let cost = payload.resource?.usageTotalUsd ?? 0;
    if (runId && !cost) cost = (await getRun(runId).catch(() => null))?.usageTotalUsd ?? 0;
    if (payload.eventType !== "ACTOR.RUN.SUCCEEDED") {
      await store.putScan({ ...scan, status: "failed", costUsd: cost, error: payload.resource?.statusMessage ?? payload.eventType ?? "failed", finishedAt: new Date().toISOString() });
      return { status: "failed" };
    }
    const items = runId ? await datasetItems(runId) : [];
    const done = await processScan(store, scan, items, cost);
    return { status: done.status };
  });
}
