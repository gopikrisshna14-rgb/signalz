import { z } from "zod";
import { body, json, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";

export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const input = await body(req, z.object({ name: z.string().trim().min(1).max(80).optional(), timezone: z.string().max(64).optional() }));
  const store = await getStore();
  const next = { ...user, ...input };
  await store.putUser(next);
  return json({ user: { id: next.id, name: next.name, email: next.email, timezone: next.timezone } });
});
