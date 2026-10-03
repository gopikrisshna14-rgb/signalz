import { requireWorkspace } from "@/lib/workspace";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return <AppShell workspace={ws}>{children}</AppShell>;
}
