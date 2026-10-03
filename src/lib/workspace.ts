import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";

/** The signed-in user's current workspace, or a redirect to /login or /onboarding. */
export async function requireWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, default_org_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("org_id, role, organizations(name)")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const list = (memberships ?? []) as unknown as {
    org_id: string;
    role: Workspace["role"];
    organizations: { name: string } | null;
  }[];
  if (list.length === 0) redirect("/onboarding");

  const current = list.find((m) => m.org_id === profile?.default_org_id) ?? list[0];
  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    orgId: current.org_id,
    orgName: current.organizations?.name ?? "Workspace",
    role: current.role,
  };
}
