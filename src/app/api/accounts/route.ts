import { dashboardData, loadCompanies } from "@/lib/accounts";
import { json, route } from "@/lib/api";
import { requireMember } from "@/lib/auth/context";
import { getStore } from "@/lib/store";

/** Account list for the current workspace. `?compact=1` returns only names (⌘K). */
export const GET = route(async (req: Request) => {
  const ctx = await requireMember();
  const store = await getStore();
  if (new URL(req.url).searchParams.get("compact")) {
    const companies = await loadCompanies(store, ctx.org.id);
    return json({ accounts: companies.map((c) => ({ id: c.id, name: c.name, domain: c.domain, tier: c.score?.tier ?? null })) });
  }
  const data = await dashboardData(store, ctx.org.id);
  return json({ rows: data.rows, kpis: data.kpis, deltas: data.deltas, freshAt: data.freshAt });
});
