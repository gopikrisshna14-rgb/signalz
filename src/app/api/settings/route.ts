import { ApiError, body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin, requireMember } from "@/lib/auth/context";
import { safeRegex } from "@/lib/pipeline/rules";
import { getStore } from "@/lib/store";
import { Settings } from "@/lib/types";

export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  return json({ settings: await store.getSettings(ctx.org.id) });
});

const Patch = Settings.partial().omit({ icpUpdatedAt: true });

/** Admin: update ICP, scoring, saved searches, exclusions or the do-not-scrape list. */
export const PUT = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const input = await body(req, Patch);
  const store = await getStore();
  const current = await store.getSettings(ctx.org.id);
  const next = Settings.parse({ ...current, ...input });
  const w = next.weights;
  if (Math.abs(w.cluster + w.fit + w.timing + w.reach - 1) > 0.011) throw new ApiError(400, "weights", "Weights must add up to 100 %");
  if (next.warmThreshold >= next.hotThreshold) throw new ApiError(400, "thresholds", "Warm must be below Hot");
  const bad = next.exclusions.filter((p) => !safeRegex(p));
  if (bad.length) throw new ApiError(400, "regex", `Invalid pattern: ${bad.join(", ")}`);
  const icpKeys = ["countries", "industries", "headcountMin", "headcountMax", "functions", "ownProduct", "clusterWindowDays", "minClusterRoles", "leaderTenureDays", "weights", "hotThreshold", "warmThreshold", "exclusions"];
  const touchedIcp = Object.keys(input).some((k) => icpKeys.includes(k));
  const saved = { ...next, icpUpdatedAt: touchedIcp ? new Date().toISOString() : current.icpUpdatedAt };
  await store.putSettings(ctx.org.id, saved);
  await audit(store, ctx.org.id, ctx.user, "settings.updated", Object.keys(input).join(", "));
  return json({ settings: saved });
});
