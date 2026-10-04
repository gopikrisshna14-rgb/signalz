import { AppShell } from "@/components/shell/app-shell";
import { activeOrgs, pageCtx } from "@/lib/auth/context";
import { storeMode } from "@/lib/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await pageCtx();
  const orgs = await activeOrgs(ctx.user);
  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email, image: ctx.user.image }}
      org={{ id: ctx.org.id, name: ctx.org.name }}
      orgs={orgs.map((o) => ({ id: o.org.id, name: o.org.name, role: o.membership.role }))}
      role={ctx.role}
      demoMode={storeMode() === "memory"}
    >
      {children}
    </AppShell>
  );
}
