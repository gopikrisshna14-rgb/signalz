import { json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/context";
import { seedDemo } from "@/lib/demo";
import { getStore } from "@/lib/store";

/** Admin: load the demo accounts into the current workspace (idempotent: same ids each time). */
export const POST = route(async () => {
  const ctx = await requireAdmin();
  const store = await getStore();
  const n = await seedDemo(store, ctx.org.id);
  await audit(store, ctx.org.id, ctx.user, "demo.seeded", null, `${n} accounts`);
  return json({ accounts: n });
});
