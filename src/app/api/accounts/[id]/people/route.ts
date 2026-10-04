import { z } from "zod";
import { recomputeAndSave } from "@/lib/accounts";
import { body, forbidden, json, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireCompany } from "@/lib/auth/context";

/** Admin (GDPR): delete a person from an account, optionally adding them to the do-not-scrape list. */
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { personId, doNotScrape } = await body(req, z.object({ personId: z.string(), doNotScrape: z.boolean().default(false) }));
  const { ctx, store, company } = await requireCompany(id);
  if (!ctx.isAdmin) throw forbidden("Only admins can delete people");
  const person = company.people.find((p) => p.id === personId);
  if (!person) throw notFound("Person not found");
  const settings = await store.getSettings(company.orgId);
  if (doNotScrape) {
    const entry = person.linkedinUrl ?? person.name;
    if (!settings.doNotScrape.includes(entry)) await store.putSettings(company.orgId, { ...settings, doNotScrape: [...settings.doNotScrape, entry] });
  }
  await store.withCompanyLock(id, async () => {
    const fresh = (await store.getCompany(id))!;
    const contactIds = { ...fresh.crm.hubspotContactIds };
    delete contactIds[personId];
    await recomputeAndSave(store, { ...fresh, people: fresh.people.filter((p) => p.id !== personId), crm: { ...fresh.crm, hubspotContactIds: contactIds } }, settings);
  });
  await audit(store, ctx.org.id, ctx.user, doNotScrape ? "person.deleted+blocked" : "person.deleted", company.name);
  return json({ ok: true });
});
