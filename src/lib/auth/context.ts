import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiError, forbidden, notFound } from "@/lib/api";
import { getStore } from "@/lib/store";
import type { Membership, Org, Role, User } from "@/lib/types";

export const ORG_COOKIE = "signalz_org";

export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return (await getStore()).getUser(id);
}

export interface Ctx {
  user: User;
  org: Org;
  membership: Membership;
  role: Role;
  isAdmin: boolean;
}

/** Active memberships of a user, newest first. */
export async function activeOrgs(user: User): Promise<{ org: Org; membership: Membership }[]> {
  const store = await getStore();
  const ids = await store.listUserOrgIds(user.id);
  const out: { org: Org; membership: Membership }[] = [];
  for (const id of ids) {
    const [org, members] = await Promise.all([store.getOrg(id), store.getMembers(id)]);
    const m = members[user.id];
    if (org && m?.status === "active") out.push({ org, membership: m });
  }
  return out;
}

async function resolveCtx(user: User): Promise<Ctx | null> {
  const orgs = await activeOrgs(user);
  if (!orgs.length) return null;
  const wanted = (await cookies()).get(ORG_COOKIE)?.value ?? user.defaultOrgId;
  const hit = orgs.find((o) => o.org.id === wanted) ?? orgs[0];
  const role = hit.membership.role;
  return { user, org: hit.org, membership: hit.membership, role, isAdmin: role === "owner" || role === "admin" };
}

/** For pages: the signed-in user and current workspace, or a redirect to /login or /onboarding. */
export async function pageCtx(): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await resolveCtx(user);
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Sign in first");
  return user;
}

/** For route handlers: membership of the current workspace (or of `orgId` when given). */
export async function requireMember(orgId?: string): Promise<Ctx> {
  const user = await requireUser();
  if (orgId) {
    const store = await getStore();
    const [org, members] = await Promise.all([store.getOrg(orgId), store.getMembers(orgId)]);
    const m = members[user.id];
    if (!org || !m) throw notFound("Workspace not found");
    if (m.status !== "active") throw forbidden("Your access to this workspace is deactivated");
    return { user, org, membership: m, role: m.role, isAdmin: m.role !== "member" };
  }
  const ctx = await resolveCtx(user);
  if (!ctx) throw new ApiError(403, "no_workspace", "Create or join a workspace first");
  return ctx;
}

export async function requireAdmin(orgId?: string): Promise<Ctx> {
  const ctx = await requireMember(orgId);
  if (!ctx.isAdmin) throw forbidden("Only admins can do this");
  return ctx;
}

export async function requireOwner(orgId?: string): Promise<Ctx> {
  const ctx = await requireMember(orgId);
  if (ctx.role !== "owner") throw forbidden("Only the owner can do this");
  return ctx;
}

/** Loads a company and checks it belongs to a workspace the user is an active member of. 404 otherwise. */
export async function requireCompany(companyId: string) {
  const store = await getStore();
  const company = await store.getCompany(companyId);
  if (!company) throw notFound("Account not found");
  const user = await requireUser();
  const m = (await store.getMembers(company.orgId))[user.id];
  if (!m || m.status !== "active") throw notFound("Account not found");
  const org = (await store.getOrg(company.orgId))!;
  const ctx: Ctx = { user, org, membership: m, role: m.role, isAdmin: m.role !== "member" };
  return { company, ctx, store };
}
