import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { activeOrgs, ORG_COOKIE, requireAdmin, requireOwner, requireUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { createOrg } from "@/lib/workspace";

const Domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter a domain like company.com")
  .nullable()
  .optional();

/** List my workspaces. */
export const GET = route(async () => {
  const user = await requireUser();
  const orgs = await activeOrgs(user);
  return json({ orgs: orgs.map((o) => ({ ...o.org, role: o.membership.role })) });
});

/** Create a workspace (the creator becomes owner). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = await body(req, z.object({ name: z.string().trim().min(2).max(60), emailDomain: Domain, autoJoin: z.boolean().optional() }));
  const store = await getStore();
  if (input.emailDomain && input.autoJoin && (await store.findOrgByDomain(input.emailDomain)))
    throw new ApiError(409, "domain_taken", "Another workspace already auto-joins this domain");
  const org = await createOrg(store, user, input);
  (await cookies()).set(ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return json({ org }, { status: 201 });
});

/** Switch the current workspace. */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const { orgId } = await body(req, z.object({ orgId: z.string() }));
  const orgs = await activeOrgs(user);
  if (!orgs.some((o) => o.org.id === orgId)) throw new ApiError(404, "not_found", "Workspace not found");
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  const store = await getStore();
  await store.putUser({ ...user, defaultOrgId: orgId });
  return json({ ok: true });
});

/** Update the current workspace (admin). */
export const PATCH = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const input = await body(req, z.object({ name: z.string().trim().min(2).max(60).optional(), emailDomain: Domain, autoJoin: z.boolean().optional() }));
  const store = await getStore();
  const next = { ...ctx.org };
  if (input.name) next.name = input.name;
  if (input.emailDomain !== undefined) next.emailDomain = input.emailDomain || null;
  if (input.autoJoin !== undefined) next.autoJoin = input.autoJoin && Boolean(next.emailDomain);
  if (next.emailDomain && next.autoJoin) {
    const other = await store.findOrgByDomain(next.emailDomain);
    if (other && other.id !== next.id) throw new ApiError(409, "domain_taken", "Another workspace already auto-joins this domain");
  }
  await store.putOrg(next);
  await audit(store, ctx.org.id, ctx.user, "workspace.updated", next.name, JSON.stringify(input));
  return json({ org: next });
});

/** Delete the current workspace and all its data (owner). */
export const DELETE = route(async (req: Request) => {
  const ctx = await requireOwner();
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  if (confirm !== ctx.org.name) throw new ApiError(400, "confirm_mismatch", "Type the workspace name to confirm");
  const store = await getStore();
  await store.deleteOrg(ctx.org.id);
  (await cookies()).delete(ORG_COOKIE);
  return json({ ok: true });
});
