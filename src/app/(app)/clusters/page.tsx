import type { Metadata } from "next";
import { ClustersView } from "@/components/clusters/clusters-view";
import { loadCompanies } from "@/lib/accounts";
import { clusterRows, divisionWeeks, functionRegion, newClustersPerWeek, roleFamilies, weekLabels } from "@/lib/analytics";
import { pageCtx } from "@/lib/auth/context";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Clusters" };

export default async function ClustersPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const [companies, settings, signals] = await Promise.all([loadCompanies(store, ctx.org.id), store.getSettings(ctx.org.id), store.listSignals(ctx.org.id, 1000)]);
  const rows = clusterRows(companies);
  return (
    <ClustersView
      rows={rows}
      fnRegion={functionRegion(rows)}
      divisionWeeks={divisionWeeks(companies)}
      weeks={weekLabels(12)}
      perWeek={newClustersPerWeek(signals, companies)}
      families={roleFamilies(companies, settings)}
      windowDays={settings.clusterWindowDays}
    />
  );
}
