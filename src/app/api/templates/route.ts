import { z } from "zod";
import { body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireMember } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { defaultTemplates } from "@/lib/templates";
import { Angle } from "@/lib/types";

export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  const t = await store.getTemplates(ctx.org.id);
  return json({ templates: t.length ? t : defaultTemplates() });
});

const Tpl = z.object({
  id: z.string(),
  angle: Angle,
  name: z.string().trim().min(1).max(60),
  connectionNote: z.string().max(400),
  message: z.string().max(1200),
  emailSubject: z.string().max(200),
  emailBody: z.string().max(3000),
});

/** Save one template (any member may edit; changes are audited). */
export const PUT = route(async (req: Request) => {
  const ctx = await requireMember();
  const input = await body(req, Tpl);
  const store = await getStore();
  const list = await store.getTemplates(ctx.org.id);
  const base = list.length ? list : defaultTemplates();
  const next = { ...input, updatedAt: new Date().toISOString() };
  const i = base.findIndex((t) => t.id === input.id || t.angle === input.angle);
  const saved = i === -1 ? [...base, next] : base.map((t, j) => (j === i ? next : t));
  await store.putTemplates(ctx.org.id, saved);
  await audit(store, ctx.org.id, ctx.user, "template.saved", input.name);
  return json({ templates: saved });
});
