import { z } from "zod";
import { ApiError, body, json, route } from "@/lib/api";
import { requireMember } from "@/lib/auth/context";
import { apifyEnabled, researchLimitPerDay } from "@/lib/env";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { advanceSimulations, createResearch, markStuck } from "@/lib/pipeline/steps";
import { getStore } from "@/lib/store";

export const maxDuration = 60;

/** Research queue (polled every 3 s while anything runs). Also advances simulations and fails stuck requests. */
export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  let list = await store.listResearch(ctx.org.id, 100);
  const changed = (await advanceSimulations(store, list)) || (await markStuck(store, list)) > 0;
  if (changed) list = await store.listResearch(ctx.org.id, 100);
  return json({ research: list.map(({ context: _c, ...r }) => r), apify: apifyEnabled() });
});

/** Start research for up to 25 LinkedIn person or company URLs. */
export const POST = route(async (req: Request) => {
  const ctx = await requireMember();
  const input = await body(req, z.object({ urls: z.array(z.string().max(500)).min(1).max(25), simulate: z.boolean().optional() }));
  const simulate = input.simulate ?? !apifyEnabled();
  if (!simulate && !apifyEnabled()) throw new ApiError(400, "apify_missing", "APIFY_TOKEN is not set. Use “Simulate with demo data”.");
  if (!simulate && !process.env.APIFY_WEBHOOK_SECRET) throw new ApiError(400, "apify_secret_missing", "APIFY_WEBHOOK_SECRET is not set");

  const seen = new Set<string>();
  const valid: { url: string; kind: "person" | "company" }[] = [];
  const invalid: string[] = [];
  for (const u of input.urls) {
    const n = normalizeLinkedInUrl(u);
    if (!n) invalid.push(u);
    else if (!seen.has(n.url)) {
      seen.add(n.url);
      valid.push({ url: n.url, kind: n.kind });
    }
  }
  if (!valid.length) throw new ApiError(400, "no_valid_urls", "None of these is a LinkedIn person (/in/…) or company (/company/…) URL");

  const store = await getStore();
  const settings = await store.getSettings(ctx.org.id);
  const blocked = new Set(settings.doNotScrape.map((x) => x.toLowerCase()));
  const allowed = valid.filter((v) => !blocked.has(v.url.toLowerCase()));
  const limit = researchLimitPerDay();
  const day = new Date().toISOString().slice(0, 10);
  const created = [];
  for (const v of allowed) {
    const n = await store.hit(`research:${ctx.user.id}:${day}`, 86_400);
    if (n > limit) {
      if (!created.length) throw new ApiError(429, "rate_limited", `Daily limit of ${limit} research requests reached. Try again tomorrow.`);
      break;
    }
    created.push(await createResearch(store, { orgId: ctx.org.id, userId: ctx.user.id, url: v.url, kind: v.kind, simulated: simulate }));
  }
  return json({ created: created.map((r) => ({ id: r.id, url: r.url, status: r.status })), invalid, blocked: valid.length - allowed.length }, { status: 201 });
});
