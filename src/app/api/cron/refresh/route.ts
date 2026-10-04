import { json, route } from "@/lib/api";
import { requireCron } from "@/lib/cron";
import { apifyEnabled } from "@/lib/env";
import { newId } from "@/lib/ids";
import { startStep } from "@/lib/pipeline/steps";
import { getStore } from "@/lib/store";
import type { Research } from "@/lib/types";

export const maxDuration = 300;

/** Daily 05:00 UTC: re-run the jobs step for companies enriched more than 24 h ago (max 50 per run). */
export const GET = route(async (req: Request) => {
  requireCron(req);
  if (!apifyEnabled() || !process.env.APIFY_WEBHOOK_SECRET) return json({ started: 0, skipped: "Apify not configured" });
  const store = await getStore();
  const cutoff = Date.now() - 86_400_000;
  const due: { orgId: string; id: string; name: string; linkedinUrl: string | null; linkedinId: string | null; country: string | null; enrichedAt: number }[] = [];
  for (const orgId of await store.listOrgIds()) {
    const org = await store.getOrg(orgId);
    if (!org || org.isDemo) continue;
    for (const c of await store.listCompanies(orgId)) {
      const t = Date.parse(c.enrichedAt ?? c.createdAt);
      if (t < cutoff && c.status === "prospect" && !c.sources.every((s) => s.kind === "demo")) due.push({ orgId, id: c.id, name: c.name, linkedinUrl: c.linkedinUrl, linkedinId: c.linkedinId, country: c.country, enrichedAt: t });
    }
  }
  due.sort((a, b) => a.enrichedAt - b.enrichedAt);
  let started = 0;
  for (const c of due.slice(0, 50)) {
    const now = new Date().toISOString();
    const r: Research = {
      id: newId("res"),
      orgId: c.orgId,
      requestedBy: "cron",
      url: c.linkedinUrl ?? c.name,
      kind: "company",
      status: "queued",
      error: null,
      runIds: [],
      costUsd: 0,
      companyId: c.id,
      personId: null,
      simulated: false,
      context: { refresh: true, companyUrl: c.linkedinUrl ?? undefined, company: { name: c.name, linkedinUrl: c.linkedinUrl, linkedinId: c.linkedinId, country: c.country } },
      createdAt: now,
      updatedAt: now,
    };
    await store.putResearch(r);
    await startStep(store, r, "jobs");
    started++;
  }
  return json({ due: due.length, started });
});
