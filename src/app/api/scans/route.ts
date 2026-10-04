import { z } from "zod";
import { ApiError, body, json, notFound, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin, requireMember } from "@/lib/auth/context";
import { apifyEnabled } from "@/lib/env";
import { startScan } from "@/lib/pipeline/scan";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  return json({ scans: await store.listScans(ctx.org.id, 50) });
});

/** Admin: run a saved search now. Without APIFY_TOKEN it runs on fixtures. */
export const POST = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const { searchId, simulate } = await body(req, z.object({ searchId: z.string(), simulate: z.boolean().optional() }));
  const store = await getStore();
  const settings = await store.getSettings(ctx.org.id);
  const search = settings.savedSearches.find((s) => s.id === searchId);
  if (!search) throw notFound("Saved search not found");
  const sim = simulate ?? !apifyEnabled();
  if (!sim && !process.env.APIFY_WEBHOOK_SECRET) throw new ApiError(400, "apify_secret_missing", "APIFY_WEBHOOK_SECRET is not set");
  const scan = await startScan(store, ctx.org.id, search, { simulate: sim });
  await audit(store, ctx.org.id, ctx.user, "scan.started", scan.name, sim ? "simulated" : null);
  return json({ scan }, { status: 201 });
});
