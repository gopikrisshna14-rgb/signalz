import { ApiError, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireCompany } from "@/lib/auth/context";

type P = { params: Promise<{ id: string }> };

/** Claim an account. Fails when someone else owns it. */
export const POST = route(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const { ctx, store } = await requireCompany(id);
  const company = await store.withCompanyLock(id, async () => {
    const fresh = (await store.getCompany(id))!;
    if (fresh.owner && fresh.owner.userId !== ctx.user.id) throw new ApiError(409, "claimed", `Claimed by ${fresh.owner.name}`, { owner: fresh.owner });
    const next = { ...fresh, owner: { userId: ctx.user.id, name: ctx.user.name, claimedAt: new Date().toISOString() } };
    await store.putCompany(next);
    return next;
  });
  await audit(store, ctx.org.id, ctx.user, "account.claimed", company.name);
  return json({ owner: company.owner });
});

/** Release a claim: your own, or any claim as an admin. */
export const DELETE = route(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const { ctx, store } = await requireCompany(id);
  const company = await store.withCompanyLock(id, async () => {
    const fresh = (await store.getCompany(id))!;
    if (!fresh.owner) return fresh;
    if (fresh.owner.userId !== ctx.user.id && !ctx.isAdmin) throw new ApiError(403, "forbidden", `Claimed by ${fresh.owner.name}. Only admins can release someone else’s claim.`);
    const next = { ...fresh, owner: null };
    await store.putCompany(next);
    return { ...next, previous: fresh.owner };
  });
  if ("previous" in company) await audit(store, ctx.org.id, ctx.user, "account.released", company.name, `was ${company.previous.name}`);
  return json({ owner: null });
});
