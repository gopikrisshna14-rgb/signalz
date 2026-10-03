import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import type { Account, JustChanged, Kpis } from "@/lib/types";
import { Dashboard } from "@/components/dashboard/dashboard";
import { loadMarketScans } from "@/lib/market-scan";

export default async function TodayPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();

  const [accounts, kpis, changed, members, scans] = await Promise.all([
    supabase.from("v_accounts").select("*").eq("org_id", ws.orgId).order("priority_score", { ascending: false }),
    supabase.from("v_kpis").select("*").eq("org_id", ws.orgId).maybeSingle(),
    supabase
      .from("v_just_changed")
      .select("*")
      .eq("org_id", ws.orgId)
      .order("occurred_at", { ascending: false })
      .limit(12),
    supabase.from("memberships").select("user_id").eq("org_id", ws.orgId).eq("status", "active"),
    loadMarketScans(supabase, ws.orgId, 3),
  ]);
  const memberIds = (members.data ?? []).map((m) => m.user_id as string);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };

  const loadError = accounts.error ?? kpis.error ?? changed.error;
  const owners = ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
    id: p.id,
    name: p.full_name ?? "Teammate",
  }));

  return (
    <Dashboard
      workspace={ws}
      accounts={(accounts.data ?? []) as Account[]}
      kpis={(kpis.data as Kpis | null) ?? null}
      justChanged={(changed.data ?? []) as JustChanged[]}
      owners={owners}
      loadError={loadError ? loadError.message : null}
      marketScans={scans}
    />
  );
}
