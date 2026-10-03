import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import { hasN8n } from "@/lib/n8n";
import { ResearchView, type ResearchRow } from "@/components/research/research-view";

export default async function ResearchPage() {
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_requests")
    .select("id, linkedin_url, kind, status, progress, error, company_id, created_at, finished_at, requested_by, companies(name)")
    .eq("org_id", ws.orgId)
    .order("created_at", { ascending: false })
    .limit(40);

  return <ResearchView workspace={ws} initial={(data ?? []) as unknown as ResearchRow[]} connected={hasN8n()} />;
}
