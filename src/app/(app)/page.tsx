import type { Metadata } from "next";
import { TodayView } from "@/components/dashboard/today";
import { dashboardData } from "@/lib/accounts";
import { pageCtx } from "@/lib/auth/context";
import { apifyEnabled } from "@/lib/env";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const [data, members, research, invites] = await Promise.all([
    dashboardData(store, ctx.org.id),
    store.getMembers(ctx.org.id),
    store.listResearch(ctx.org.id, 1),
    store.listInvites(ctx.org.id),
  ]);
  const names = await Promise.all(
    Object.entries(members)
      .filter(([, m]) => m.status === "active")
      .map(async ([id]) => ({ userId: id, name: (await store.getUser(id))?.name ?? "Unknown" })),
  );
  return (
    <TodayView
      rows={data.rows}
      kpis={data.kpis}
      deltas={data.deltas}
      feed={data.feed}
      freshAt={data.freshAt}
      total={data.total}
      windowDays={data.settings.clusterWindowDays}
      me={{ id: ctx.user.id, name: ctx.user.name }}
      isAdmin={ctx.isAdmin}
      members={names}
      checklist={{
        apify: apifyEnabled(),
        research: research.length > 0,
        icp: Boolean(data.settings.icpUpdatedAt),
        invite: names.length > 1 || invites.length > 0,
        export: data.exportedAny,
      }}
    />
  );
}
