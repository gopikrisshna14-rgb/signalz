import { z } from "zod";
import { body, json, route } from "@/lib/api";
import { requireAdmin, requireMember } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { Membership, Role } from "@/lib/types";
import { memberList, updateMember } from "@/lib/workspace";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await requireMember(id);
  const store = await getStore();
  return json({ members: await memberList(store, id), seatLimit: ctx.org.seatLimit });
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await requireAdmin(id);
  const input = await body(req, z.object({ userId: z.string(), role: Role.optional(), status: Membership.shape.status.optional() }));
  const store = await getStore();
  const m = await updateMember(store, ctx.org, ctx, input.userId, { role: input.role, status: input.status });
  return json({ membership: m });
});
