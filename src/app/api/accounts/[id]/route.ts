import { z } from "zod";
import { accountDetail } from "@/lib/account-detail";
import { recomputeAndSave } from "@/lib/accounts";
import { body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireCompany } from "@/lib/auth/context";
import { CompanyStatus } from "@/lib/types";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const { company, ctx, store } = await requireCompany(id);
  return json(await accountDetail(store, company, ctx));
});

/** Change the account status (customer, open opportunity, disqualified) or routing. */
export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { ctx, store } = await requireCompany(id);
  const input = await body(req, z.object({ status: CompanyStatus.optional(), routedTo: z.string().max(80).nullable().optional() }));
  const settings = await store.getSettings(ctx.org.id);
  const saved = await store.withCompanyLock(id, async () => {
    const fresh = (await store.getCompany(id))!;
    const next = { ...fresh, ...(input.status ? { status: input.status } : {}), ...(input.routedTo !== undefined ? { routedTo: input.routedTo } : {}) };
    return (await recomputeAndSave(store, next, settings)).company;
  });
  await audit(store, ctx.org.id, ctx.user, "account.updated", saved.name, JSON.stringify(input));
  return json({ company: { id: saved.id, status: saved.status, score: saved.score } });
});
