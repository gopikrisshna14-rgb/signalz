import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import type { ClustersData } from "@/lib/sample-data";
import { ClustersView } from "@/components/clusters/clusters-view";

const ROLE_FAMILY: Record<string, string> = {
  sdr_bdr: "SDR / BDR",
  account_executive: "Account Executive",
  sales_leader: "Head of Sales",
  revops: "RevOps",
  account_manager: "Account Manager",
  sales_engineer: "Sales Engineer",
  sales_enablement: "Enablement",
  customer_success: "Customer Success",
  marketing: "Marketing",
};

export default async function ClustersPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const since = new Date(Date.now() - 84 * 86400000).toISOString();

  const [clusters, fr, dw, postings] = await Promise.all([
    supabase
      .from("hiring_clusters")
      .select(
        "id, company_id, open_roles, builder_roles, leader_roles, revops_roles, new_leader_days, crm_mentions, cluster_score, first_detected_at, companies(name), divisions(label, function, region)",
      )
      .eq("org_id", ws.orgId)
      .eq("status", "active")
      .order("cluster_score", { ascending: false }),
    supabase.from("v_heatmap_function_region").select("*").eq("org_id", ws.orgId),
    supabase.from("v_heatmap_division_week").select("*").eq("org_id", ws.orgId),
    supabase.from("job_postings").select("role_family").eq("org_id", ws.orgId).eq("is_excluded", false).gte("posted_at", since),
  ]);

  type Row = {
    id: string;
    company_id: string;
    open_roles: number;
    builder_roles: number;
    leader_roles: number;
    revops_roles: number;
    new_leader_days: number | null;
    crm_mentions: string[];
    cluster_score: number;
    first_detected_at: string;
    companies: { name: string } | null;
    divisions: { label: string; function: string; region: string } | null;
  };
  const rows = (clusters.data ?? []) as unknown as Row[];

  const perWeekMap = new Map<string, number>();
  for (const c of rows) {
    const d = new Date(c.first_detected_at);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    perWeekMap.set(k, (perWeekMap.get(k) ?? 0) + 1);
  }
  const roleCounts = new Map<string, number>();
  for (const p of postings.data ?? []) {
    const k = ROLE_FAMILY[(p.role_family as string) ?? ""] ?? "Other";
    roleCounts.set(k, (roleCounts.get(k) ?? 0) + 1);
  }

  const live: ClustersData = {
    clusters: rows.map((c) => ({
      id: c.id,
      company_id: c.company_id,
      company: c.companies?.name ?? "—",
      division: c.divisions?.label ?? "—",
      function: c.divisions?.function ?? "other",
      region: c.divisions?.region || "Unknown",
      open_roles: c.open_roles,
      builder_roles: c.builder_roles,
      leader_roles: c.leader_roles,
      revops_roles: c.revops_roles,
      new_leader_days: c.new_leader_days,
      crm_mentions: c.crm_mentions ?? [],
      cluster_score: c.cluster_score,
      first_detected_at: c.first_detected_at,
    })),
    functionRegion: (fr.data ?? []).map((r) => ({
      function: r.function as string,
      region: r.region as string,
      clusters: Number(r.clusters),
      open_roles: Number(r.open_roles),
      avg_score: Number(r.avg_score),
    })),
    divisionWeek: (dw.data ?? []).map((r) => ({
      label: r.division_label as string,
      company: r.company_name as string,
      week_start: r.week_start as string,
      roles: Number(r.roles),
    })),
    perWeek: [...perWeekMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, clusters]) => ({ week, clusters })),
    roleFamilies: [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([role, count]) => ({ role, count })),
  };

  return <ClustersView live={live} />;
}
