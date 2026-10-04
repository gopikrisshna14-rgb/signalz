import "server-only";
import { appUrl } from "@/lib/env";
import { newId } from "@/lib/ids";
import { normalizeLinkedInUrl, slugToName } from "@/lib/linkedin";
import { actorId, actorInput, datasetItems, getRun, sign, startRun, type ActorKind } from "@/lib/pipeline/apify";
import { classifyJobs, classifyPerson } from "@/lib/pipeline/classify";
import { companyFixture, employeesFixture, jobsFixture, postsFixture, profileFixture } from "@/lib/pipeline/fixtures";
import { mapCompany, mapJob, mapPerson, type CompanyDraft, type JobDraft, type PersonDraft } from "@/lib/pipeline/mappers";
import { mergeCompany } from "@/lib/pipeline/merge";
import { classifyPersonByRules, roleFamily } from "@/lib/pipeline/rules";
import type { Store } from "@/lib/store/store";
import type { Person, Research, ResearchStep } from "@/lib/types";

type Raw = Record<string, unknown>;
type ActorStep = "profile" | "posts" | "company" | "employees" | "jobs" | "stepstone";

const ACTOR_OF: Record<ActorStep, ActorKind> = { profile: "profile", posts: "posts", company: "company", employees: "employees", jobs: "jobs", stepstone: "stepstone" };
export const STUCK_AFTER_MS = 20 * 60_000;
const SIM_DELAY_MS = 1500;

const optionalEnabled = (r: Research, kind: ActorKind) => r.simulated || Boolean(process.env[`APIFY_${kind.toUpperCase()}_ACTOR_ID`]);

type Ctx = {
  person?: PersonDraft;
  companyUrl?: string;
  company?: CompanyDraft;
  employees?: PersonDraft[];
  jobsQuery?: "company" | "keyword";
  simReadyAt?: number;
  refresh?: boolean;
  companyId?: string;
};
const ctxOf = (r: Research) => r.context as Ctx;

async function save(store: Store, r: Research, patch: Partial<Research>): Promise<Research> {
  const next = { ...r, ...patch, updatedAt: new Date().toISOString() };
  await store.putResearch(next);
  return next;
}

export function callbackUrl(id: string, step: string, param: "r" | "scan" = "r"): string {
  return `${appUrl()}/api/apify/callback?${param}=${encodeURIComponent(id)}&step=${step}&sig=${sign(id, step)}`;
}

/** Input for a step's actor (also used for the jobs search URL). */
function inputFor(r: Research, step: ActorStep) {
  const c = ctxOf(r);
  switch (step) {
    case "profile":
    case "posts":
      return actorInput(ACTOR_OF[step], { url: r.url });
    case "company":
    case "employees":
      return actorInput(ACTOR_OF[step], { url: c.companyUrl ?? r.url });
    case "jobs": {
      const id = c.company?.linkedinId;
      const url = id
        ? `https://www.linkedin.com/jobs/search/?f_C=${id}&f_TPR=r5184000`
        : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(c.company?.name ?? "")}&f_TPR=r5184000`;
      return actorInput("jobs", { url, keywords: id ? undefined : c.company?.name, days: 60, max: 100 });
    }
    case "stepstone":
      return actorInput("stepstone", { keywords: c.company?.name ?? "", location: "Deutschland", days: 30, max: 50 });
  }
}

/** Starts one step: an Apify run with a signed webhook, or a fixture run when simulated. */
export async function startStep(store: Store, r: Research, step: ActorStep): Promise<Research> {
  const ctx = ctxOf(r);
  if (step === "jobs") ctx.jobsQuery = ctx.company?.linkedinId ? "company" : "keyword";
  if (r.simulated) return save(store, r, { status: step, context: { ...ctx, simReadyAt: Date.now() + SIM_DELAY_MS } });
  const actor = actorId(ACTOR_OF[step]);
  if (!actor) return fail(store, r, `No actor configured for ${step} (set APIFY_${ACTOR_OF[step].toUpperCase()}_ACTOR_ID)`);
  try {
    const { runId } = await startRun(actor, inputFor(r, step), callbackUrl(r.id, step));
    return save(store, r, { status: step, runIds: [...r.runIds, runId], context: ctx, error: null });
  } catch (e) {
    return fail(store, r, e instanceof Error ? e.message : String(e));
  }
}

export async function fail(store: Store, r: Research, message: string): Promise<Research> {
  return save(store, r, { status: "failed", error: message });
}

export async function createResearch(store: Store, input: { orgId: string; userId: string; url: string; kind: "person" | "company"; simulated: boolean }): Promise<Research> {
  const now = new Date().toISOString();
  const r: Research = {
    id: newId("res"),
    orgId: input.orgId,
    requestedBy: input.userId,
    url: input.url,
    kind: input.kind,
    status: "queued",
    error: null,
    runIds: [],
    costUsd: 0,
    companyId: null,
    personId: null,
    simulated: input.simulated,
    context: {},
    createdAt: now,
    updatedAt: now,
  };
  await store.putResearch(r);
  return startFirst(store, r);
}

export async function startFirst(store: Store, r: Research): Promise<Research> {
  const reset: Research = { ...r, status: "queued", error: null, context: ctxOf(r).refresh ? r.context : {} };
  if (ctxOf(r).refresh) return startStep(store, reset, "jobs");
  if (r.kind === "person") return startStep(store, reset, "profile");
  return startStep(store, { ...reset, context: { companyUrl: r.url } }, "company");
}

/* ------------------------------------------------------------------ */
/* Step results                                                        */
/* ------------------------------------------------------------------ */

function nextAfter(r: Research, step: ActorStep): ActorStep | "finish" {
  switch (step) {
    case "profile":
      return optionalEnabled(r, "posts") ? "posts" : "company";
    case "posts":
      return "company";
    case "company":
      return r.kind === "company" && optionalEnabled(r, "employees") ? "employees" : "jobs";
    case "employees":
      return "jobs";
    case "jobs":
      return !r.simulated && process.env.APIFY_STEPSTONE_ACTOR_ID && ["DE", "AT", "CH"].includes(ctxOf(r).company?.country ?? "") ? "stepstone" : "finish";
    case "stepstone":
      return "finish";
  }
}

function toPerson(d: PersonDraft, source: string, cls: Person["cls"]): Person {
  return {
    id: newId("per"),
    name: d.name,
    firstName: d.firstName,
    lastName: d.lastName,
    title: d.title,
    linkedinUrl: d.linkedinUrl,
    email: d.email,
    location: d.location,
    country: d.country,
    roleStartedAt: d.roleStartedAt,
    previousRoles: d.previousRoles.map((p) => ({ company: p.company, title: p.title, from: p.from, to: p.to })),
    schools: d.schools,
    posts: d.posts.slice(0, 3),
    mutualConnections: null,
    sharedHistory: null,
    source,
    scrapedAt: new Date().toISOString(),
    cls,
  };
}

const sameEmployer = (a: string | null, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/\b(gmbh|ag|se|kg|ltd|inc|co|llc)\b\.?/g, "").replace(/[^a-z0-9äöüß]+/g, "");
  return a !== null && (n(a).includes(n(b)) || n(b).includes(n(a)));
};

/** Handles a finished step with its dataset items. Shared by the Apify callback and the simulation. */
export async function onStepSuccess(store: Store, r: Research, step: ActorStep, items: Raw[], costUsd: number): Promise<Research> {
  r = { ...r, costUsd: Math.round((r.costUsd + costUsd) * 10000) / 10000 };
  const ctx: Ctx = { ...ctxOf(r) };
  delete ctx.simReadyAt;
  const settings = await store.getSettings(r.orgId);

  if (step === "profile") {
    if (!items[0]) return fail(store, r, "The profile actor returned no data (private profile or wrong URL?)");
    const person = mapPerson(items[0]);
    if (!person.linkedinUrl) person.linkedinUrl = r.url;
    if (settings.doNotScrape.map((x) => x.toLowerCase()).includes(person.linkedinUrl.toLowerCase())) return fail(store, r, "This person is on the do-not-scrape list");
    if (!person.currentCompanyUrl) return fail(store, r, "No current company with a LinkedIn page on this profile. Research the company URL instead.");
    ctx.person = person;
    ctx.companyUrl = person.currentCompanyUrl;
  } else if (step === "posts") {
    if (ctx.person) {
      const posts = items.map((p) => mapPerson({ posts: [p] }).posts[0]).filter(Boolean);
      ctx.person = { ...ctx.person, posts: posts.slice(0, 3) };
    }
  } else if (step === "company") {
    const company = items[0] ? mapCompany(items[0]) : null;
    const slug = normalizeLinkedInUrl(ctx.companyUrl ?? r.url)?.slug ?? "";
    ctx.company = company ?? mapCompany({ name: slugToName(slug) || ctx.person?.currentCompanyName || "Unknown company" });
    if (!ctx.company.linkedinUrl) ctx.company.linkedinUrl = ctx.companyUrl ?? r.url;
    if (ctx.company.name === "Unknown company" && ctx.person?.currentCompanyName) ctx.company.name = ctx.person.currentCompanyName;
  } else if (step === "employees") {
    ctx.employees = items
      .map((x) => mapPerson(x))
      .filter((p) => p.name && ["leader", "revops"].includes(roleFamily(p.title)))
      .slice(0, 10);
  } else {
    // jobs / stepstone: classify, score, merge.
    const company = ctx.company;
    if (!company) return fail(store, r, "Company step did not run");
    let drafts = items.map((x) => mapJob(x)).filter((j): j is JobDraft => j !== null);
    if (step === "stepstone" || ctx.jobsQuery === "keyword") drafts = drafts.filter((j) => sameEmployer(j.employerName, company.name));
    r = await save(store, r, { status: "classifying", costUsd: r.costUsd, context: ctx });
    const { results } = await classifyJobs(
      drafts.map((d) => ({ title: d.title, description: d.description, location: d.location, country: d.country, employerName: d.employerName ?? company.name })),
      settings,
    );
    const people: Person[] = [];
    if (ctx.person && step === "jobs") {
      const p = ctx.person;
      const cls = await classifyPerson({ title: p.title, location: p.location, skills: p.skills, previousRoles: p.previousRoles, about: p.about });
      people.push(toPerson(p, "LinkedIn profile (Apify)", cls));
    }
    for (const e of step === "jobs" ? (ctx.employees ?? []) : []) people.push(toPerson(e, "LinkedIn employees (Apify)", classifyPersonByRules({ title: e.title, location: e.location, previousRoles: e.previousRoles })));
    r = await save(store, r, { status: "scoring" });
    const { company: saved } = await mergeCompany(store, {
      orgId: r.orgId,
      company,
      jobs: drafts.map((draft, i) => ({ draft, cls: results[i] })),
      jobSource: step === "stepstone" ? "stepstone" : "linkedin",
      closeMissing: true,
      people,
      sourceKind: step === "stepstone" ? "stepstone" : r.simulated ? "simulation" : "research",
    });
    const personId = ctx.person ? (saved.people.find((p) => p.linkedinUrl === ctx.person!.linkedinUrl)?.id ?? null) : r.personId;
    r = { ...r, companyId: saved.id, personId };
  }

  const next = nextAfter(r, step);
  if (next === "finish") return save(store, r, { status: "done", context: { ...ctx, simReadyAt: undefined }, error: null });
  return startStep(store, { ...r, context: ctx }, next);
}

/** Apify webhook handler body. Idempotent: ignores callbacks for a step that is not current. */
export async function handleResearchCallback(store: Store, id: string, step: string, payload: { eventType?: string; resource?: { id?: string; status?: string; statusMessage?: string; usageTotalUsd?: number } }) {
  return store.withCompanyLock(`research:${id}`, async () => {
    const r = await store.getResearch(id);
    if (!r) return { ignored: "unknown research" };
    if (r.status !== step) return { ignored: `step ${step} is not current (${r.status})` };
    const runId = payload.resource?.id;
    if (runId && r.runIds.length && !r.runIds.includes(runId)) return { ignored: "run is not part of this research" };
    const ok = payload.eventType === "ACTOR.RUN.SUCCEEDED" || payload.resource?.status === "SUCCEEDED";
    let cost = payload.resource?.usageTotalUsd ?? 0;
    if (runId && !cost) cost = (await getRun(runId).catch(() => null))?.usageTotalUsd ?? 0;
    if (!ok) {
      const what = payload.eventType?.replace("ACTOR.RUN.", "").toLowerCase().replace("_", " ") ?? "failed";
      await save(store, { ...r, costUsd: r.costUsd + cost }, { status: "failed", error: `Apify ${step} run ${what}: ${payload.resource?.statusMessage ?? "no message"}` });
      return { status: "failed" };
    }
    const items = runId ? await datasetItems(runId) : [];
    const next = await onStepSuccess(store, r, step as ActorStep, items, cost);
    return { status: next.status };
  });
}

/* ------------------------------------------------------------------ */
/* Simulation + housekeeping                                           */
/* ------------------------------------------------------------------ */

function fixtureItems(r: Research, step: ActorStep): Raw[] {
  const ctx = ctxOf(r);
  const personSlug = normalizeLinkedInUrl(r.url)?.slug ?? "alex-example";
  const companySlug = normalizeLinkedInUrl(ctx.companyUrl ?? r.url)?.slug ?? "example";
  switch (step) {
    case "profile":
      return profileFixture(personSlug);
    case "posts":
      return postsFixture(personSlug);
    case "company":
      return companyFixture(companySlug);
    case "employees":
      return employeesFixture(companySlug);
    case "jobs":
    case "stepstone":
      return jobsFixture(ctx.company?.name ?? slugToName(companySlug), companySlug);
  }
}

const ACTIVE: ResearchStep[] = ["queued", "profile", "posts", "company", "employees", "jobs", "stepstone", "classifying", "scoring"];

/** Advances simulated requests whose fixture "run" is ready. Called while the research page polls. */
export async function advanceSimulations(store: Store, list: Research[]): Promise<boolean> {
  let changed = false;
  for (const r of list) {
    if (!r.simulated || !ACTIVE.includes(r.status)) continue;
    const ready = ctxOf(r).simReadyAt;
    if (!ready || Date.now() < ready) continue;
    if (!(r.status in ACTOR_OF)) continue;
    await store.withCompanyLock(`research:${r.id}`, async () => {
      const fresh = await store.getResearch(r.id);
      if (!fresh || fresh.status !== r.status || ctxOf(fresh).simReadyAt !== ready) return;
      await onStepSuccess(store, fresh, fresh.status as ActorStep, fixtureItems(fresh, fresh.status as ActorStep), 0);
      changed = true;
    });
  }
  return changed;
}

/** Requests unchanged for 20 minutes are failed ("No answer from Apify"). */
export async function markStuck(store: Store, list: Research[], now = Date.now()): Promise<number> {
  let n = 0;
  for (const r of list) {
    if (r.simulated || !ACTIVE.includes(r.status)) continue;
    if (now - Date.parse(r.updatedAt) < STUCK_AFTER_MS) continue;
    await fail(store, r, "No answer from Apify after 20 minutes");
    n++;
  }
  return n;
}
