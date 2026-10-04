import { loadCompanies } from "@/lib/accounts";
import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireMember } from "@/lib/auth/context";
import { toCsv, toJson } from "@/lib/export";
import { getStore } from "@/lib/store";

/** GET /api/export?format=csv|json&ids=a,b&sep=; — CRM-ready export of the selected accounts (all when no ids). */
export const GET = route(async (req: Request) => {
  const ctx = await requireMember();
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const sep = url.searchParams.get("sep") === ";" ? ";" : ",";
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);
  const store = await getStore();
  const all = await loadCompanies(store, ctx.org.id);
  const companies = ids?.length ? all.filter((c) => ids.includes(c.id)) : all;
  const now = new Date();
  for (const c of companies)
    if (!c.crm.exportedAt) await store.withCompanyLock(c.id, async () => {
      const fresh = await store.getCompany(c.id);
      if (fresh) await store.putCompany({ ...fresh, crm: { ...fresh.crm, exportedAt: now.toISOString() } });
    });
  await audit(store, ctx.org.id, ctx.user, "export", `${companies.length} accounts`, format);
  const stamp = now.toISOString().slice(0, 10);
  if (format === "json")
    return new Response(JSON.stringify(toJson(companies, now), null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="signalz-accounts-${stamp}.json"` },
    });
  return new Response(toCsv(companies, sep, now), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="signalz-accounts-${stamp}.csv"` },
  });
});
