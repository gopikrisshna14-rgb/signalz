import { json, route } from "@/lib/api";
import { requireCron } from "@/lib/cron";
import { markStuck } from "@/lib/pipeline/steps";
import { getStore } from "@/lib/store";

/** Every 15 min (Pro) or daily (Hobby): fail requests unchanged for 20 minutes. */
export const GET = route(async (req: Request) => {
  requireCron(req);
  const store = await getStore();
  let failed = 0;
  for (const orgId of await store.listOrgIds()) failed += await markStuck(store, await store.listResearch(orgId, 200));
  return json({ failed });
});
