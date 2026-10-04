"use client";

import { AlertCircle, Check, ExternalLink, FlaskConical, Loader2, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pills";
import { relativeTime, usd } from "@/lib/format";
import { STEP_LABEL, type Research, type ResearchStep } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = Omit<Research, "context">;

const ACTIVE: ResearchStep[] = ["queued", "profile", "posts", "company", "employees", "jobs", "stepstone", "classifying", "scoring"];

function stepsFor(r: Row): ResearchStep[] {
  const base: ResearchStep[] = r.kind === "person" ? ["queued", "profile", "company", "jobs", "classifying", "scoring", "done"] : ["queued", "company", "jobs", "classifying", "scoring", "done"];
  return base;
}

/** Where a status sits in the visible step list (optional steps map onto their neighbour). */
function position(r: Row, steps: ResearchStep[]): number {
  const map: Partial<Record<ResearchStep, ResearchStep>> = { posts: "profile", employees: "company", stepstone: "jobs" };
  const s = map[r.status] ?? r.status;
  return steps.indexOf(s);
}

function Steps({ r }: { r: Row }) {
  const steps = stepsFor(r);
  const failed = r.status === "failed";
  const pos = failed ? -1 : position(r, steps);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Progress">
      {steps.map((s, i) => {
        const done = r.status === "done" || (!failed && i < pos);
        const current = !failed && i === pos && r.status !== "done";
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                done ? "bg-accent-soft text-accent" : current ? "bg-warm-bg text-warm-fg" : "bg-surface-2 text-muted",
              )}
              aria-current={current ? "step" : undefined}
            >
              {done ? <Check size={11} aria-hidden /> : current ? <Loader2 size={11} className="animate-spin" aria-hidden /> : null}
              {STEP_LABEL[s]}
              {current && (r.status === "posts" || r.status === "employees" || r.status === "stepstone") ? ` · ${STEP_LABEL[r.status]}` : ""}
            </span>
            {i < steps.length - 1 ? <span className="h-px w-2 bg-line" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ResearchView({ initial, companyNames, apify, webhookSecret, limit }: { initial: Row[]; companyNames: Record<string, string>; apify: boolean; webhookSecret: boolean; limit: number }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const running = rows.some((r) => ACTIVE.includes(r.status));

  const poll = useCallback(async () => {
    const res = await fetch("/api/research").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setRows((prev) => {
      const wasRunning = prev.filter((r) => ACTIVE.includes(r.status)).map((r) => r.id);
      const finished = (data.research as Row[]).filter((r) => wasRunning.includes(r.id) && r.status === "done");
      if (finished.length) router.refresh();
      return data.research;
    });
  }, [router]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [running, poll]);

  async function submit(simulate: boolean) {
    setError(null);
    const urls = text.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return setError("Paste at least one LinkedIn URL");
    if (urls.length > 25) return setError("At most 25 URLs at a time");
    const res = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls, simulate }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.message ?? "Could not start research");
    toast.success(`Researching ${data.created.length} URL${data.created.length === 1 ? "" : "s"}${data.invalid.length ? `, ${data.invalid.length} skipped (not a LinkedIn person or company URL)` : ""}`);
    setText("");
    await poll();
  }

  async function retry(id: string) {
    const res = await fetch(`/api/research/${id}/retry`, { method: "POST" });
    if (!res.ok) toast.error((await res.json().catch(() => ({}))).message ?? "Retry failed");
    await poll();
  }

  const totalCost = rows.reduce((a, r) => a + r.costUsd, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-semibold">Research</h1>
        <p className="mt-0.5 text-[13px] text-muted">Paste a LinkedIn profile or company URL. Signalz scrapes the profile, the company and its open jobs, then classifies and scores them.</p>
      </header>

      {!apify ? (
        <Card className="border-warm-fg/30 bg-warm-bg/40">
          <CardHeader title="Apify is not connected" description="Add APIFY_TOKEN and APIFY_WEBHOOK_SECRET in Vercel to research real URLs. Until then, simulate the same pipeline on demo fixtures." />
          <CardBody className="flex flex-wrap gap-2 pt-3 text-[13px]">
            <Link href="/settings?tab=sources" className="text-accent hover:underline">
              How to connect Apify
            </Link>
          </CardBody>
        </Card>
      ) : !webhookSecret ? (
        <Card className="border-danger-fg/30">
          <CardHeader title="APIFY_WEBHOOK_SECRET is missing" description="Apify can’t call back without it. Add a long random string in Vercel → Environment Variables." />
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(() => submit(!apify));
            }}
          >
            <label htmlFor="urls" className="text-[13px] font-medium">
              Paste a LinkedIn profile or company URL
            </label>
            <p className="text-[12px] text-muted">One per line, up to 25. Your limit is {limit} per day.</p>
            <Textarea
              id="urls"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://www.linkedin.com/in/jonas-weber\nde.linkedin.com/company/laufwerk-sneakers"}
              className="mt-2 min-h-24 font-mono text-[13px]"
            />
            {error ? (
              <p role="alert" className="mt-2 text-[13px] text-danger-fg">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {apify ? (
                <Button type="submit" variant="primary" disabled={pending}>
                  <Sparkles size={14} /> {pending ? "Starting…" : "Start research"}
                </Button>
              ) : null}
              <Button type="button" variant={apify ? "secondary" : "primary"} disabled={pending} onClick={() => start(() => submit(true))}>
                <FlaskConical size={14} /> Simulate with demo data
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <section aria-labelledby="queue-title">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="queue-title" className="text-[14px] font-semibold">
            Queue
          </h2>
          <span className="tabular text-[12px] text-muted">Apify cost so far: {usd(totalCost)}</span>
        </div>
        <div aria-live="polite" aria-busy={running}>
          {rows.length === 0 ? (
            <EmptyState title="No research yet" text="Paste a URL above to research your first account." />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <Pill>{r.kind === "person" ? "Person" : "Company"}</Pill>
                      {r.simulated ? <Pill tone="info">Simulated</Pill> : null}
                      {r.requestedBy === "cron" ? <Pill>Daily refresh</Pill> : null}
                      <a href={r.url.startsWith("http") ? r.url : undefined} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium hover:underline">
                        {r.url.replace("https://www.linkedin.com", "")}
                      </a>
                      <span className="text-[12px] text-muted">{relativeTime(r.createdAt)}</span>
                    </div>
                    <div className="mt-1.5">
                      <Steps r={r} />
                    </div>
                    {r.status === "failed" ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-danger-fg">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden /> {r.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-[12px] text-muted">{usd(r.costUsd)}</span>
                    {r.status === "done" && r.companyId ? (
                      <Button asChild size="sm">
                        <Link href={`/accounts/${r.companyId}`}>
                          {companyNames[r.companyId] ?? "Open account"} <ExternalLink size={12} />
                        </Link>
                      </Button>
                    ) : null}
                    {r.status === "failed" ? (
                      <Button size="sm" onClick={() => retry(r.id)}>
                        <RotateCcw size={14} /> Retry
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
