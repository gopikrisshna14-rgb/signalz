"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Building2, Check, Loader2, PlugZap, RotateCw, Search, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, errorMessage, relativeTime } from "@/lib/format";
import { normalizeLinkedIn } from "@/lib/linkedin";
import type { Workspace } from "@/lib/types";
import { Button, Card } from "@/components/ui";

export interface ResearchRow {
  id: string;
  linkedin_url: string;
  kind: "person" | "company";
  status: string;
  progress: number;
  error: string | null;
  company_id: string | null;
  created_at: string;
  finished_at: string | null;
  requested_by: string;
  companies?: { name: string } | null;
}

const STEPS = [
  { key: "queued", label: "Queued" },
  { key: "scraping_profile", label: "Profile" },
  { key: "scraping_company", label: "Company" },
  { key: "scraping_jobs", label: "Jobs" },
  { key: "classifying", label: "Classifying" },
  { key: "scoring", label: "Scoring" },
  { key: "done", label: "Done" },
];

function slugOf(url: string) {
  const m = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  try {
    return m ? decodeURIComponent(m[1]!) : url;
  } catch {
    return m?.[1] ?? url;
  }
}

export function ResearchView({ workspace, initial, connected }: { workspace: Workspace; initial: ResearchRow[]; connected: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<ResearchRow[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => setRows(initial), [initial]);

  // Live status: n8n updates research_requests, Supabase Realtime pushes the change here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`research-${workspace.orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "research_requests", filter: `org_id=eq.${workspace.orgId}` },
        (payload) => {
          const row = payload.new as ResearchRow;
          if (!row?.id) return;
          setRows((prev) => {
            const i = prev.findIndex((r) => r.id === row.id);
            if (i === -1) return [row, ...prev];
            const next = [...prev];
            next[i] = { ...prev[i], ...row, companies: prev[i]!.companies };
            return next;
          });
          if (row.status === "done") router.refresh(); // picks up the company name
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace.orgId, router]);

  const lines = useMemo(() => text.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean), [text]);
  const parsed = useMemo(() => lines.map((l) => ({ raw: l, n: normalizeLinkedIn(l) })), [lines]);
  const validCount = parsed.filter((p) => p.n).length;
  const invalid = parsed.filter((p) => !p.n);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validCount === 0) return;
    if (validCount > 25) return toast.error("Up to 25 URLs at once.");
    setBusy(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);
      const failed = (data.requests as { ok: boolean; error: string | null }[]).filter((r) => !r.ok);
      if (failed.length) toast.error(failed[0]!.error ?? "Could not start the research");
      else toast.success(`Researching ${data.requests.length} ${data.requests.length === 1 ? "URL" : "URLs"}…`);
      setText("");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setRetrying(id);
    try {
      const res = await fetch(`/api/research/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error);
      toast.success("Sent again");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRetrying(null);
    }
  }

  const running = rows.filter((r) => !["done", "failed"].includes(r.status)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Research</h1>
        <p className="mt-0.5 text-[14px] text-muted">
          Paste a LinkedIn profile or company URL. We find the company&apos;s open roles, the decision maker and score it.
        </p>
      </div>

      {!connected && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-warm-bg px-3.5 py-3 text-[13px] text-warm-fg">
          <PlugZap size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>The research workflow is not connected yet.</b> You can queue URLs, but nothing runs until an admin adds{" "}
            <code>N8N_RESEARCH_WEBHOOK_URL</code> and <code>N8N_WEBHOOK_SECRET</code> in Vercel (see <code>n8n/README.md</code>).
          </span>
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={submit}>
          <label htmlFor="urls" className="sr-only">
            LinkedIn URLs
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
            <textarea
              id="urls"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
              }}
              rows={lines.length > 1 ? Math.min(8, lines.length + 1) : 2}
              placeholder={"https://www.linkedin.com/in/jane-doe\nhttps://www.linkedin.com/company/acme   (one per line, up to 25)"}
              className="w-full resize-y rounded-lg border border-line bg-surface py-3 pr-3 pl-10 text-[14px] placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] text-muted">
              {lines.length === 0 ? (
                "Profile URLs find the person and their company; company URLs research the company."
              ) : (
                <>
                  <span className={cn(validCount > 25 && "text-danger-fg")}>{validCount} valid</span>
                  {invalid.length > 0 && (
                    <span className="text-danger-fg">
                      {" "}
                      · {invalid.length} not a LinkedIn profile/company URL ({invalid[0]!.raw.slice(0, 40)}
                      {invalid.length > 1 ? ", …" : ""})
                    </span>
                  )}
                </>
              )}
            </div>
            <Button variant="primary" disabled={busy || validCount === 0 || validCount > 25}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {busy ? "Starting…" : validCount > 1 ? `Research ${validCount} URLs` : "Research"}
            </Button>
          </div>
        </form>
      </Card>

      <section aria-live="polite">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">Recent requests</h2>
          {running > 0 && <span className="text-[12px] text-muted">{running} running</span>}
        </div>
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-[13px] text-muted">No research yet. Paste your first LinkedIn URL above.</Card>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <RequestRow key={r.id} row={r} onRetry={retry} retrying={retrying === r.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestRow({ row: r, onRetry, retrying }: { row: ResearchRow; onRetry: (id: string) => void; retrying: boolean }) {
  const failed = r.status === "failed";
  const done = r.status === "done";
  const steps = r.kind === "company" ? STEPS.filter((s) => s.key !== "scraping_profile") : STEPS;
  const current = Math.max(0, steps.findIndex((s) => s.key === r.status));

  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
            failed ? "bg-danger-bg text-danger-fg" : done ? "bg-ok/15 text-ok" : "bg-accent-soft text-accent",
          )}
        >
          {r.kind === "company" ? <Building2 size={15} /> : <User size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{r.companies?.name ?? slugOf(r.linkedin_url)}</div>
          <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-muted hover:underline">
            {r.linkedin_url.replace("https://www.", "")}
          </a>
        </div>
        <span className="hidden shrink-0 text-[12px] text-muted sm:block">{relativeTime(r.created_at)}</span>
        {done && r.company_id ? (
          <Link
            href={`/accounts/${r.company_id}`}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 text-[12px] font-medium text-accent-fg hover:opacity-90"
          >
            Open <ArrowRight size={12} />
          </Link>
        ) : failed ? (
          <Button size="sm" onClick={() => onRetry(r.id)} disabled={retrying}>
            <RotateCw size={12} className={cn(retrying && "animate-spin")} /> Retry
          </Button>
        ) : (
          <Loader2 size={16} className="shrink-0 animate-spin text-accent" aria-label="Running" />
        )}
      </div>

      {failed ? (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-danger-bg px-2.5 py-2 text-[12px] text-danger-fg">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{r.error ?? "Something went wrong."}</span>
        </div>
      ) : (
        !done && (
          <ol className="mt-3 flex items-center gap-1" aria-label={`Step ${current + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <li key={s.key} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("h-1 rounded-full", i < current ? "bg-chart-1" : i === current ? "animate-pulse bg-chart-1" : "bg-surface-2")} />
                <span className={cn("truncate text-[11px]", i <= current ? "text-fg" : "text-muted")}>
                  {i < current && <Check size={10} className="mr-0.5 inline" />}
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        )
      )}
    </Card>
  );
}
