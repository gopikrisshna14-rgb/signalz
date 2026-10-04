import { z } from "zod";
import { ApiError, body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireMember } from "@/lib/auth/context";
import { buildPushPlan, HubspotError, pushPlan } from "@/lib/crm/hubspot";
import { decrypt } from "@/lib/crypto";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

/** Push accounts to HubSpot. `dryRun: true` returns the exact payload without sending it. */
export const POST = route(async (req: Request) => {
  const ctx = await requireMember();
  const { companyIds, dryRun } = await body(req, z.object({ companyIds: z.array(z.string()).min(1).max(50), dryRun: z.boolean().default(true) }));
  const store = await getStore();
  const cfg = await store.getHubspot(ctx.org.id);
  if (!cfg && !dryRun) throw new ApiError(400, "not_connected", "Connect HubSpot in Settings → Integrations first");
  const companies = (await Promise.all(companyIds.map((id) => store.getCompany(id)))).filter((c) => c && c.orgId === ctx.org.id);
  if (!companies.length) throw new ApiError(404, "not_found", "No accounts found");
  const plans = companies.map((c) => buildPushPlan(c!, cfg?.mapping ?? {}));
  if (dryRun) return json({ dryRun: true, plans });

  const token = decrypt(cfg!.tokenEnc);
  const results: { companyId: string; ok: boolean; hubspotCompanyId?: string; error?: string }[] = [];
  for (const plan of plans) {
    try {
      const r = await pushPlan(token, plan);
      await store.withCompanyLock(plan.companyId, async () => {
        const fresh = await store.getCompany(plan.companyId);
        if (fresh)
          await store.putCompany({
            ...fresh,
            crm: { ...fresh.crm, hubspotCompanyId: r.companyHsId, hubspotContactIds: { ...fresh.crm.hubspotContactIds, ...r.contactIds }, exportedAt: new Date().toISOString() },
          });
      });
      results.push({ companyId: plan.companyId, ok: true, hubspotCompanyId: r.companyHsId });
    } catch (e) {
      results.push({ companyId: plan.companyId, ok: false, error: e instanceof HubspotError ? e.message : String(e) });
    }
  }
  await audit(store, ctx.org.id, ctx.user, "hubspot.push", `${results.filter((r) => r.ok).length}/${results.length} accounts`, results.filter((r) => !r.ok).map((r) => r.error).join("; ") || null);
  return json({ dryRun: false, results });
});
