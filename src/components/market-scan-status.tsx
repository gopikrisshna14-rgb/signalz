import { AlertTriangle, CheckCircle2, Loader2, ScanSearch } from "lucide-react";
import { cn, relativeTime } from "@/lib/format";
import type { MarketScanRun } from "@/lib/market-scan";
import { Card } from "@/components/ui";

const usd = (v: number | null) => (v == null ? "—" : `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`);
const jobs = (r: MarketScanRun) => r.unique_job_count ?? r.raw_job_count;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-muted">{label}</div>
      <div className="tabular text-[15px] font-semibold">{value}</div>
    </div>
  );
}

/** "Latest market scan": the last completed bulk scan, plus a note if a newer one is running or failed. */
export function MarketScanStatus({ runs, className }: { runs: MarketScanRun[]; className?: string }) {
  if (runs.length === 0) return null;
  const last = runs.find((r) => r.status === "completed") ?? null;
  const newest = runs[0]!;
  const pending = newest.status !== "completed" && newest !== last ? newest : null;

  return (
    <Card className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3", className)}>
      <div className="flex min-w-[180px] items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <ScanSearch size={16} />
        </span>
        <div>
          <div className="text-[13px] font-semibold">Latest market scan</div>
          <div className="text-[12px] text-muted">
            {last ? `Last completed ${relativeTime(last.finished_at ?? last.created_at)}` : "No completed scan yet"}
          </div>
        </div>
      </div>
      {last && (
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat label="Jobs processed" value={jobs(last) ?? "—"} />
          <Stat label="Companies scored" value={last.company_count} />
          <Stat label="Hits found" value={last.hit_count} />
          <Stat label="Apify cost" value={usd(last.apify_cost_usd)} />
        </div>
      )}
      {pending && (
        <div
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] sm:w-auto",
            pending.status === "failed" ? "bg-danger-bg text-danger-fg" : "bg-surface-2 text-muted",
          )}
          title={pending.error ?? undefined}
        >
          {pending.status === "failed" ? <AlertTriangle size={13} /> : <Loader2 size={13} className="animate-spin" />}
          {pending.status === "failed"
            ? `Newer scan failed ${relativeTime(pending.finished_at ?? pending.created_at)}${pending.error ? `: ${pending.error.slice(0, 80)}` : ""}`
            : `Scan running since ${relativeTime(pending.started_at)}`}
        </div>
      )}
    </Card>
  );
}

/** Settings: the last few runs as a table. */
export function MarketScanHistory({ runs }: { runs: MarketScanRun[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-[14px] font-semibold">Market scans</h2>
      <p className="mt-0.5 text-[12px] text-muted">
        Bulk LinkedIn Jobs scans from n8n (<code>rpc/ingest_market_scan</code>). Results appear on Today like any other account.
      </p>
      {runs.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No scans yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Run</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 pr-3 text-right font-medium">Jobs</th>
                <th className="py-1.5 pr-3 text-right font-medium">Companies</th>
                <th className="py-1.5 pr-3 text-right font-medium">Hits</th>
                <th className="py-1.5 text-right font-medium">Apify</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line" title={r.error ?? undefined}>
                  <td className="py-2 pr-3">
                    <div>{relativeTime(r.finished_at ?? r.created_at)}</div>
                    {r.n8n_execution_id && <div className="text-[11px] text-muted">n8n #{r.n8n_execution_id}</div>}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[12px] font-medium",
                        r.status === "completed" ? "text-ok" : r.status === "failed" ? "text-danger-fg" : "text-muted",
                      )}
                    >
                      {r.status === "completed" ? <CheckCircle2 size={13} /> : r.status === "failed" ? <AlertTriangle size={13} /> : <Loader2 size={13} className="animate-spin" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{jobs(r) ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">{r.company_count}</td>
                  <td className="py-2 pr-3 text-right">{r.hit_count}</td>
                  <td className="py-2 text-right">{usd(r.apify_cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
