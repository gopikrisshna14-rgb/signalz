import { cookies } from "next/headers";
import { ApiError, json, notFound, route } from "@/lib/api";
import { ORG_COOKIE, requireUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { joinOrg } from "@/lib/workspace";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const user = await requireUser();
  const store = await getStore();
  const invite = await store.getInvite(token);
  if (!invite || invite.acceptedAt || Date.parse(invite.expiresAt) < Date.now()) throw notFound("This invite has expired or was already used");
  if (invite.email.toLowerCase() !== user.email.toLowerCase())
    throw new ApiError(403, "wrong_account", `This invite is for ${invite.email}. Sign in with that e-mail to accept it.`);
  const org = await store.getOrg(invite.orgId);
  if (!org) throw notFound("Workspace not found");
  await joinOrg(store, org, user, invite.role, "invite");
  await store.deleteInvite(invite);
  (await cookies()).set(ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return json({ orgId: org.id });
});
