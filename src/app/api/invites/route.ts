import { z } from "zod";
import { body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/context";
import { appUrl } from "@/lib/env";
import { newToken } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { Role, type Invite } from "@/lib/types";

export const GET = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const store = await getStore();
  const invites = await store.listInvites(ctx.org.id);
  return json({ invites: invites.map((i) => ({ ...i, url: `${appUrl(req)}/invite/${i.token}` })) });
});

export const POST = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const input = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), role: Role.exclude(["owner"]).default("member") }));
  const store = await getStore();
  const invite: Invite = {
    token: newToken(),
    orgId: ctx.org.id,
    email: input.email,
    role: input.role,
    invitedBy: ctx.user.id,
    expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  };
  await store.putInvite(invite);
  await audit(store, ctx.org.id, ctx.user, "invite.created", input.email, input.role);
  return json({ invite: { ...invite, url: `${appUrl(req)}/invite/${invite.token}` } }, { status: 201 });
});

export const DELETE = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const { token } = await body(req, z.object({ token: z.string() }));
  const store = await getStore();
  const invite = await store.getInvite(token);
  if (invite && invite.orgId === ctx.org.id) {
    await store.deleteInvite(invite);
    await audit(store, ctx.org.id, ctx.user, "invite.revoked", invite.email);
  }
  return json({ ok: true });
});
