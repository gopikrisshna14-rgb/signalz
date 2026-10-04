import type { Metadata } from "next";
import { ResearchView } from "@/components/research/research-view";
import { pageCtx } from "@/lib/auth/context";
import { apifyEnabled, researchLimitPerDay } from "@/lib/env";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const list = await store.listResearch(ctx.org.id, 100);
  const companies = new Map((await Promise.all([...new Set(list.map((r) => r.companyId).filter(Boolean) as string[])].map((id) => store.getCompany(id)))).filter(Boolean).map((c) => [c!.id, c!.name]));
  return (
    <ResearchView
      initial={list.map(({ context: _c, ...r }) => r)}
      companyNames={Object.fromEntries(companies)}
      apify={apifyEnabled()}
      webhookSecret={Boolean(process.env.APIFY_WEBHOOK_SECRET)}
      limit={researchLimitPerDay()}
    />
  );
}
