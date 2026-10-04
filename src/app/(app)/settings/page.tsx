import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { pageCtx } from "@/lib/auth/context";
import { appUrl } from "@/lib/env";
import { getStore } from "@/lib/store";
import { memberList } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const [members, invites] = await Promise.all([memberList(store, ctx.org.id), ctx.isAdmin ? store.listInvites(ctx.org.id) : Promise.resolve([])]);
  const base = appUrl();
  return (
    <SettingsView
      me={{ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, timezone: ctx.user.timezone ?? null }}
      org={ctx.org}
      role={ctx.role}
      members={members}
      invites={invites.map((i) => ({ ...i, url: `${base}/invite/${i.token}` }))}
    />
  );
}
