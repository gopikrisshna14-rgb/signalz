import { requireWorkspace } from "@/lib/workspace";
import { Card } from "@/components/ui";
import { AdminActions } from "./admin-actions";
import { createClient } from "@/lib/supabase/server";
import { loadMarketScans } from "@/lib/market-scan";
import { MarketScanHistory } from "@/components/market-scan-status";

export default async function SettingsPage() {
  const ws = await requireWorkspace();
  const isAdmin = ws.role !== "member";
  const scans = await loadMarketScans(await createClient(), ws.orgId, 10);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Profile</h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">Name</dt>
          <dd>{ws.fullName ?? "—"}</dd>
          <dt className="text-muted">E-mail</dt>
          <dd>{ws.email}</dd>
        </dl>
      </Card>
      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Workspace</h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
          <dt className="text-muted">Name</dt>
          <dd>{ws.orgName}</dd>
          <dt className="text-muted">Your role</dt>
          <dd className="capitalize">{ws.role}</dd>
          <dt className="text-muted">Workspace ID</dt>
          <dd className="font-mono text-[12px] break-all">{ws.orgId}</dd>
        </dl>
        {isAdmin && <AdminActions orgId={ws.orgId} />}
      </Card>
      <MarketScanHistory runs={scans} />
      <Card className="p-5 text-[13px] text-muted">
        ICP &amp; scoring, Team &amp; seats, Integrations (CRM) and the audit log arrive in the next build.
      </Card>
    </div>
  );
}
