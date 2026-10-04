import { json, route } from "@/lib/api";
import { requireMember } from "@/lib/auth/context";
import { getStore } from "@/lib/store";

/** The "Just changed" feed (polled every 30 s). */
export const GET = route(async (req: Request) => {
  const ctx = await requireMember();
  const store = await getStore();
  const limit = Math.min(200, Number(new URL(req.url).searchParams.get("limit") ?? 40));
  return json({ signals: await store.listSignals(ctx.org.id, limit) });
});
