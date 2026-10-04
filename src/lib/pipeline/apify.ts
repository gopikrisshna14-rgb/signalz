import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.apify.com/v2";

export type ActorKind = "jobs" | "profile" | "company" | "employees" | "posts" | "stepstone";

const ENV: Record<ActorKind, string> = {
  jobs: "APIFY_JOBS_ACTOR_ID",
  profile: "APIFY_PROFILE_ACTOR_ID",
  company: "APIFY_COMPANY_ACTOR_ID",
  employees: "APIFY_EMPLOYEES_ACTOR_ID",
  posts: "APIFY_POSTS_ACTOR_ID",
  stepstone: "APIFY_STEPSTONE_ACTOR_ID",
};

/** Defaults for the required actors (no LinkedIn cookie needed). Optional ones run only when set. */
const DEFAULTS: Partial<Record<ActorKind, string>> = {
  jobs: "bebity/linkedin-jobs-scraper",
  profile: "dev_fusion/linkedin-profile-scraper",
  company: "automation-lab/linkedin-company-scraper",
};

export const ACTOR_RECOMMENDATIONS: Record<ActorKind, { label: string; env: string; required: boolean; candidates: string[] }> = {
  jobs: { label: "LinkedIn jobs", env: ENV.jobs, required: true, candidates: ["bebity/linkedin-jobs-scraper", "automation-lab/linkedin-jobs-scraper", "valig/linkedin-jobs-scraper"] },
  profile: { label: "LinkedIn profile", env: ENV.profile, required: true, candidates: ["dev_fusion/linkedin-profile-scraper", "automation-lab/linkedin-profile-scraper", "usestring/linkedin-profiles"] },
  company: { label: "LinkedIn company", env: ENV.company, required: true, candidates: ["automation-lab/linkedin-company-scraper", "northbell/linkedin-company-growth-scraper"] },
  employees: { label: "Company employees (find the new leader)", env: ENV.employees, required: false, candidates: ["automation-lab/linkedin-company-employees-scraper"] },
  posts: { label: "LinkedIn posts", env: ENV.posts, required: false, candidates: ["khadinakbar/linkedin-profile-posts-scraper", "automation-lab/linkedin-post-scraper"] },
  stepstone: { label: "StepStone (DACH)", env: ENV.stepstone, required: false, candidates: ["thirdwatch/stepstone-jobs-scraper", "scrapesage/stepstone-scraper"] },
};

export function actorId(kind: ActorKind): string | null {
  return process.env[ENV[kind]] || DEFAULTS[kind] || null;
}

/** Actor IDs go into the URL as owner~name. */
export function actorPath(id: string): string {
  return id.replace("/", "~");
}

/**
 * Actor input. Actors name their input fields differently, so the default sends the common names together;
 * override per actor with APIFY_<KIND>_INPUT (JSON with {{url}}, {{urls}}, {{keywords}}, {{location}}, {{days}}).
 */
export function actorInput(kind: ActorKind, v: { url?: string; urls?: string[]; keywords?: string; location?: string; days?: number; max?: number }) {
  const override = process.env[`APIFY_${kind.toUpperCase()}_INPUT`];
  const urls = v.urls ?? (v.url ? [v.url] : []);
  if (override) {
    const filled = override
      .replaceAll('"{{urls}}"', JSON.stringify(urls))
      .replaceAll("{{url}}", urls[0] ?? "")
      .replaceAll("{{keywords}}", v.keywords ?? "")
      .replaceAll("{{location}}", v.location ?? "")
      .replaceAll('"{{days}}"', String(v.days ?? 30));
    return JSON.parse(filled) as Record<string, unknown>;
  }
  const max = v.max ?? 100;
  switch (kind) {
    case "profile":
    case "posts":
      return { profileUrls: urls, urls, startUrls: urls.map((url) => ({ url })), usernames: urls, maxPosts: 3, limit: 3 };
    case "company":
    case "employees":
      return { companyUrls: urls, urls, startUrls: urls.map((url) => ({ url })), companies: urls, maxItems: max, maxEmployees: max };
    case "jobs":
    case "stepstone":
      return {
        urls,
        startUrls: urls.map((url) => ({ url })),
        searchUrl: urls[0],
        title: v.keywords,
        keywords: v.keywords,
        keyword: v.keywords,
        location: v.location,
        rows: max,
        maxItems: max,
        count: max,
        publishedAt: v.days ? `r${v.days * 86400}` : undefined,
        scrapeCompany: true,
      };
  }
}

function secret(): string {
  const s = process.env.APIFY_WEBHOOK_SECRET;
  if (!s) throw new Error("APIFY_WEBHOOK_SECRET is not set");
  return s;
}

export function sign(id: string, step: string): string {
  return createHmac("sha256", secret()).update(`${id}.${step}`).digest("hex");
}

export function verify(id: string, step: string, sig: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const a = Buffer.from(sign(id, step), "hex");
  const b = Buffer.from(sig, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set");
  return t;
}

/** Starts an actor run asynchronously with an ad-hoc webhook that calls us back when it ends. */
export async function startRun(actor: string, input: unknown, callbackUrl: string): Promise<{ runId: string }> {
  const webhooks = [{ eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"], requestUrl: callbackUrl }];
  const qs = new URLSearchParams({ token: token(), webhooks: Buffer.from(JSON.stringify(webhooks)).toString("base64") });
  const res = await fetch(`${API}/acts/${actorPath(actor)}/runs?${qs}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const data = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: { message?: string } };
  if (!res.ok || !data.data?.id) throw new Error(`Apify could not start ${actor}: ${data.error?.message ?? res.statusText}`);
  return { runId: data.data.id };
}

export interface RunInfo {
  id: string;
  status: string;
  statusMessage: string | null;
  usageTotalUsd: number;
  defaultDatasetId: string | null;
}

export async function getRun(runId: string): Promise<RunInfo> {
  const res = await fetch(`${API}/actor-runs/${runId}?token=${token()}`);
  const data = (await res.json()) as { data: { id: string; status: string; statusMessage?: string; usageTotalUsd?: number; defaultDatasetId?: string } };
  return { id: data.data.id, status: data.data.status, statusMessage: data.data.statusMessage ?? null, usageTotalUsd: data.data.usageTotalUsd ?? 0, defaultDatasetId: data.data.defaultDatasetId ?? null };
}

export async function datasetItems(runId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API}/actor-runs/${runId}/dataset/items?token=${token()}&clean=true&format=json`);
  if (!res.ok) throw new Error(`Apify dataset for run ${runId}: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Last runs with cost, for Settings → Data sources. */
export async function recentRuns(limit = 10) {
  const res = await fetch(`${API}/actor-runs?token=${token()}&limit=${limit}&desc=1`);
  if (!res.ok) throw new Error(`Apify: ${res.status}`);
  const data = (await res.json()) as { data: { items: { id: string; actId: string; status: string; startedAt: string; usageTotalUsd?: number }[] } };
  return data.data.items;
}
