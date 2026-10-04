import { cookies } from "next/headers";
import { z } from "zod";
import { body, forbidden, json, notFound, route } from "@/lib/api";
import { ORG_COOKIE, requireUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { joinOrg } from "@/lib/workspace";

/** Join a workspace that auto-joins your e-mail domain. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { orgId } = await body(req, z.object({ orgId: z.string() }));
  const store = await getStore();
  const org = await store.getOrg(orgId);
  if (!org) throw notFound("Workspace not found");
  const domain = user.email.split("@")[1]?.toLowerCase();
  if (!org.autoJoin || !org.emailDomain || org.emailDomain !== domain) throw forbidden("This workspace does not auto-join your e-mail domain");
  await joinOrg(store, org, user, "member", "auto-join domain");
  (await cookies()).set(ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return json({ orgId: org.id });
});
