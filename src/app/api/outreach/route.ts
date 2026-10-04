import { z } from "zod";
import { recomputeAndSave } from "@/lib/accounts";
import { ApiError, body, forbidden, json, notFound, route } from "@/lib/api";
import { requireCompany, requireMember } from "@/lib/auth/context";
import { newId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { Angle, type OutreachEvent, OutreachType } from "@/lib/types";

export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  return json({ events: await store.listOutreach(ctx.org.id, 2000) });
});

/** Log a manual outreach step. Never sends anything: the SDR sends on LinkedIn and logs it here. */
export const POST = route(async (req: Request) => {
  const input = await body(
    req,
    z.object({ companyId: z.string(), personId: z.string().nullable().optional(), type: OutreachType, angle: Angle.nullable().optional(), note: z.string().max(500).nullable().optional() }),
  );
  const { ctx, store, company } = await requireCompany(input.companyId);
  if (company.owner && company.owner.userId !== ctx.user.id) throw new ApiError(409, "claimed", `Claimed by ${company.owner.name}`);
  const person = company.people.find((p) => p.id === input.personId) ?? null;
  const now = new Date().toISOString();
  const event: OutreachEvent = {
    id: newId("out"),
    orgId: company.orgId,
    companyId: company.id,
    companyName: company.name,
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    userId: ctx.user.id,
    userName: ctx.user.name,
    type: input.type,
    angle: input.angle ?? null,
    note: input.note ?? null,
    at: now,
  };
  await store.addOutreach(event);
  const settings = await store.getSettings(company.orgId);
  let claimed = false;
  const saved = await store.withCompanyLock(company.id, async () => {
    const fresh = (await store.getCompany(company.id))!;
    claimed = !fresh.owner;
    const owner = fresh.owner ?? { userId: ctx.user.id, name: ctx.user.name, claimedAt: now };
    return (await recomputeAndSave(store, { ...fresh, owner, lastOutreachAt: now }, settings)).company;
  });
  return json({ event, claimed, bucket: saved.score?.bucket, owner: saved.owner }, { status: 201 });
});

/** Undo a logged step (from the undo toast). */
export const DELETE = route(async (req: Request) => {
  const { id, companyId } = await body(req, z.object({ id: z.string(), companyId: z.string() }));
  const { ctx, store } = await requireCompany(companyId);
  const events = await store.listCompanyOutreach(companyId);
  const event = events.find((e) => e.id === id);
  if (!event) throw notFound("Event not found");
  if (event.userId !== ctx.user.id && !ctx.isAdmin) throw forbidden("You can only undo your own steps");
  await store.removeOutreach(event);
  const settings = await store.getSettings(ctx.org.id);
  const rest = events.filter((e) => e.id !== id);
  await store.withCompanyLock(companyId, async () => {
    const fresh = (await store.getCompany(companyId))!;
    await recomputeAndSave(store, { ...fresh, lastOutreachAt: rest[0]?.at ?? null }, settings);
  });
  return json({ ok: true });
});

