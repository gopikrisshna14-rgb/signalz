import type { Metadata } from "next";
import { OutreachView } from "@/components/outreach/outreach-view";
import { loadCompanies } from "@/lib/accounts";
import { pageCtx } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { defaultTemplates } from "@/lib/templates";

export const metadata: Metadata = { title: "Outreach" };

export default async function OutreachPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const [events, templates, companies] = await Promise.all([store.listOutreach(ctx.org.id, 2000), store.getTemplates(ctx.org.id), loadCompanies(store, ctx.org.id)]);
  const sample = companies.find((c) => c.clusters.length && c.people.length) ?? companies[0] ?? null;
  return <OutreachView events={events} templates={templates.length ? templates : defaultTemplates()} sample={sample} timezone={ctx.user.timezone ?? null} />;
}
