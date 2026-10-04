import { ApiError, forbidden } from "@/lib/api";
import { audit } from "@/lib/audit";
import { newId, slugify } from "@/lib/ids";
import type { Store } from "@/lib/store/store";
import { defaultTemplates } from "@/lib/templates";
import type { Membership, Org, Role, User } from "@/lib/types";
import { defaultSettings } from "@/lib/types";

export function activeCount(members: Record<string, Membership>): number {
  return Object.values(members).filter((m) => m.status === "active").length;
}

export const noSeat = (org: Org) =>
  new ApiError(409, "no_seat", `${org.name} has no seat left (${org.seatLimit} of ${org.seatLimit} used). Ask an admin to free a seat or request more seats.`);

export async function createOrg(store: Store, user: User, input: { name: string; emailDomain?: string | null; autoJoin?: boolean }): Promise<Org> {
  const now = new Date().toISOString();
  const org: Org = {
    id: newId("o"),
    name: input.name.trim(),
    slug: slugify(input.name) || "workspace",
    emailDomain: input.emailDomain?.trim().toLowerCase() || null,
    autoJoin: Boolean(input.emailDomain && input.autoJoin),
    seatLimit: 5,
    plan: "beta",
    createdAt: now,
  };
  await store.putOrg(org);
  await store.setMember(org.id, user.id, { role: "owner", status: "active", joinedAt: now });
  await store.putSettings(org.id, defaultSettings());
  await store.putTemplates(org.id, defaultTemplates());
  await store.putUser({ ...user, defaultOrgId: org.id });
  await audit(store, org.id, user, "workspace.created", org.name);
  return org;
}

/** Adds (or re-activates) a member, enforcing the seat limit. */
export async function joinOrg(store: Store, org: Org, user: User, role: Role, via: string): Promise<void> {
  const members = await store.getMembers(org.id);
  const existing = members[user.id];
  if (existing?.status === "active") return;
  if (activeCount(members) >= org.seatLimit) throw noSeat(org);
  await store.setMember(org.id, user.id, { role: existing?.role ?? role, status: "active", joinedAt: existing?.joinedAt ?? new Date().toISOString() });
  await store.putUser({ ...user, defaultOrgId: org.id });
  await audit(store, org.id, user, "member.joined", user.email, via);
}

/**
 * Changes a member's role or status. Rules: only owners grant or remove the owner role, the seat limit
 * applies on activation, and a workspace with other active members always keeps an active owner.
 */
export async function updateMember(
  store: Store,
  org: Org,
  actor: { user: User; role: Role },
  userId: string,
  patch: { role?: Role; status?: Membership["status"] },
): Promise<Membership> {
  const members = await store.getMembers(org.id);
  const current = members[userId];
  if (!current) throw new ApiError(404, "not_found", "Member not found");
  if ((patch.role === "owner" || current.role === "owner") && actor.role !== "owner") throw forbidden("Only the owner can change an owner");
  const next: Membership = { ...current, ...patch };
  if (current.status !== "active" && next.status === "active" && activeCount(members) >= org.seatLimit) throw noSeat(org);

  const after = { ...members, [userId]: next };
  const activeOthers = Object.values(after).filter((m) => m.status === "active");
  const owners = activeOthers.filter((m) => m.role === "owner");
  if (activeOthers.length > 0 && owners.length === 0)
    throw new ApiError(409, "last_owner", "The workspace needs an active owner. Make someone else owner first.");

  await store.setMember(org.id, userId, next);
  const target = await store.getUser(userId);
  const what = [patch.role ? `role → ${patch.role}` : null, patch.status ? `status → ${patch.status}` : null].filter(Boolean).join(", ");
  await audit(store, org.id, actor.user, "member.updated", target?.email ?? userId, what);
  return next;
}

export async function memberList(store: Store, orgId: string) {
  const members = await store.getMembers(orgId);
  const rows = await Promise.all(
    Object.entries(members).map(async ([id, m]) => {
      const u = await store.getUser(id);
      return { userId: id, name: u?.name ?? "Unknown", email: u?.email ?? "", image: u?.image ?? null, ...m };
    }),
  );
  const order: Record<Role, number> = { owner: 0, admin: 1, member: 2 };
  return rows.sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || order[a.role] - order[b.role] || a.name.localeCompare(b.name));
}
export type MemberRow = Awaited<ReturnType<typeof memberList>>[number];
