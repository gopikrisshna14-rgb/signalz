import { json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/context";
import { rescoreAll } from "@/lib/rescore";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

/** Admin: re-apply exclusions and recompute every account with the current settings. */
export const POST = route(async () => {
  const ctx = await requireAdmin();
  const store = await getStore();
  const n = await rescoreAll(store, ctx.org.id);
  await audit(store, ctx.org.id, ctx.user, "rescore", `${n} accounts`);
  return json({ accounts: n });
});
