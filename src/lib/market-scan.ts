import type { SupabaseClient } from "@supabase/supabase-js";

/** One row of public.market_scan_runs (007). */
export interface MarketScanRun {
  id: string;
  n8n_execution_id: string | null;
  status: "running" | "completed" | "failed";
  started_at: string;
  finished_at: string | null;
  raw_job_count: number | null;
  unique_job_count: number | null;
  company_count: number;
  hit_count: number;
  apify_cost_usd: number | null;
  error: string | null;
  created_at: string;
}

/** Latest scan runs of the workspace, newest first. Empty if migration 007 has not been run yet. */
export async function loadMarketScans(supabase: SupabaseClient, orgId: string, limit = 5): Promise<MarketScanRun[]> {
  const { data, error } = await supabase
    .from("market_scan_runs")
    .select("id, n8n_execution_id, status, started_at, finished_at, raw_job_count, unique_job_count, company_count, hit_count, apify_cost_usd, error, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({ ...r, apify_cost_usd: r.apify_cost_usd == null ? null : Number(r.apify_cost_usd) })) as MarketScanRun[];
}
