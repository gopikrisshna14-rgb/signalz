import { json, route } from "@/lib/api";
import { requireCron } from "@/lib/cron";
import { apifyEnabled } from "@/lib/env";
import { startScan } from "@/lib/pipeline/scan";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

/** Weekly: run every workspace's saved searches. */
export const GET = route(async (req: Request) => {
  requireCron(req);
  if (!apifyEnabled() || !process.env.APIFY_WEBHOOK_SECRET) return json({ started: 0, skipped: "Apify not configured" });
  const store = await getStore();
  let started = 0;
  for (const orgId of await store.listOrgIds()) {
    const settings = await store.getSettings(orgId);
    for (const s of settings.savedSearches) {
      await startScan(store, orgId, s, { simulate: false });
      started++;
    }
  }
  return json({ started });
});
