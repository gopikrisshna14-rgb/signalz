"use client";

import { CheckCircle2, CircleDashed, Database, Download, ExternalLink, Play, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pills";
import { relativeTime, shortDate, usd } from "@/lib/format";
import type { AuditEntry, SavedSearch, Scan, Settings } from "@/lib/types";

async function send(url: string, method: string, payload?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(data.message ?? "Something went wrong");
    return null;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Data sources                                                        */
/* ------------------------------------------------------------------ */

export interface SourceInfo {
  apify: boolean;
  webhookSecret: boolean;
  claude: boolean;
  model: string;
  actors: { kind: string; label: string; env: string; required: boolean; inUse: string | null; fromEnv: boolean; candidates: string[] }[];
  runs: { id: string; actId: string; status: string; startedAt: string; usageTotalUsd?: number }[] | null;
  runsError: string | null;
  researchCost: number;
  researchCount: number;
}

export function SourcesSettings({ info, settings, isAdmin }: { info: SourceInfo; settings: Settings; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [line, setLine] = useState(settings.dataSourceLine);
  const status = (ok: boolean, label: string, hint: string) => (
    <li className="flex items-start gap-2 text-[13px]">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-label="Connected" /> : <CircleDashed size={16} className="mt-0.5 shrink-0 text-muted" aria-label="Not connected" />}
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-[12px] text-muted">{hint}</div>
      </div>
    </li>
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Connections" />
        <CardBody>
          <ul className="space-y-3">
            {status(info.apify, info.apify ? "Apify connected" : "Apify not connected", info.apify ? "APIFY_TOKEN is set." : "Add APIFY_TOKEN (Apify → Settings → Integrations) in Vercel → Environment Variables.")}
            {status(info.webhookSecret, "Webhook secret", info.webhookSecret ? "APIFY_WEBHOOK_SECRET is set; callbacks are signed." : "Set APIFY_WEBHOOK_SECRET to a long random string.")}
            {status(info.claude, info.claude ? `Claude classification and openers (${info.model})` : "Claude not configured", info.claude ? "ANTHROPIC_API_KEY is set." : "Without ANTHROPIC_API_KEY the rules classifier and message templates are used.")}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Apify actors" description="Run each actor once in Apify first and check its input, output fields (start dates!) and price. Prefer actors that need no LinkedIn cookie." />
        <div className="overflow-x-auto px-4 pb-4">
          <table className="mt-3 w-full min-w-[640px] text-[13px]">
            <caption className="sr-only">Apify actors</caption>
            <thead className="text-left text-[12px] text-muted">
              <tr>
                <th className="py-1 font-medium">Source</th>
                <th className="py-1 font-medium">In use</th>
                <th className="py-1 font-medium">Env var</th>
                <th className="py-1 font-medium">Candidates</th>
              </tr>
            </thead>
            <tbody>
              {info.actors.map((a) => (
                <tr key={a.kind} className="border-t border-line align-top">
                  <td className="py-2">
                    {a.label} {a.required ? null : <Pill className="ml-1">optional</Pill>}
                  </td>
                  <td className="py-2 font-mono text-[12px]">{a.inUse ? `${a.inUse}${a.fromEnv ? "" : " (default)"}` : <span className="text-muted">off</span>}</td>
                  <td className="py-2 font-mono text-[12px] text-muted">{a.env}</td>
                  <td className="py-2">
                    <ul className="space-y-0.5">
                      {a.candidates.map((c) => (
                        <li key={c}>
                          <a href={`https://apify.com/${c}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline">
                            {c} <ExternalLink size={11} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Last runs and cost" description={`${info.researchCount} research requests in this workspace cost ${usd(info.researchCost)} in Apify usage.`} />
        <CardBody>
          {info.runs ? (
            info.runs.length ? (
              <ul className="divide-y divide-line text-[13px]">
                {info.runs.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-x-3 py-1.5">
                    <span className="font-mono text-[12px]">{r.actId}</span>
                    <Pill tone={r.status === "SUCCEEDED" ? "accent" : r.status === "RUNNING" ? "info" : "danger"}>{r.status.toLowerCase()}</Pill>
                    <span className="text-muted">{relativeTime(r.startedAt)}</span>
                    <span className="tabular ml-auto">{usd(r.usageTotalUsd ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No runs yet.</p>
            )
          ) : (
            <p className="text-[13px] text-muted">{info.runsError ?? "Connect Apify to see runs."}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data protection (GDPR)" description="Only business-context data is stored. Posts and raw job texts are dropped after 180 days." />
        <CardBody className="space-y-4">
          <Switch
            id="ds-line"
            checked={line}
            label="Add a line to e-mail openers saying where the data came from (Art. 14)"
            onCheckedChange={(v) => {
              if (!isAdmin) return;
              setLine(v);
              start(async () => {
                if (await send("/api/settings", "PUT", { dataSourceLine: v })) toast.success("Saved");
              });
            }}
          />
          <div>
            <div className="text-[13px] font-medium">Do-not-scrape list ({settings.doNotScrape.length})</div>
            <p className="text-[12px] text-muted">People removed from accounts by an admin. They are skipped in every future research.</p>
            {settings.doNotScrape.length ? (
              <ul className="mt-2 space-y-1">
                {settings.doNotScrape.map((x) => (
                  <li key={x} className="flex items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{x}</span>
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            if (await send("/api/settings", "PUT", { doNotScrape: settings.doNotScrape.filter((y) => y !== x) })) router.refresh();
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader title="Demo data" description="Load 22 sample accounts into this workspace. Loading again refreshes them without duplicating history." />
          <CardBody>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await send("/api/demo/seed", "POST");
                  if (r) {
                    toast.success(`Loaded ${r.accounts} demo accounts`);
                    router.refresh();
                  }
                })
              }
            >
              <Database size={14} /> Load demo data
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Market scans                                                        */
/* ------------------------------------------------------------------ */

export function ScansSettings({ searches, scans, isAdmin, apify }: { searches: SavedSearch[]; scans: Scan[]; isAdmin: boolean; apify: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const save = (next: SavedSearch[]) =>
    start(async () => {
      if (await send("/api/settings", "PUT", { savedSearches: next })) {
        setOpen(false);
        router.refresh();
      }
    });
  const run = (id: string) =>
    start(async () => {
      const r = await send("/api/scans", "POST", { searchId: id });
      if (r) {
        toast.success(r.scan.status === "done" ? `Scan finished: ${r.scan.companies} companies, ${r.scan.hits} with a cluster` : r.scan.status === "failed" ? `Scan failed: ${r.scan.error}` : "Scan started. Results arrive when Apify calls back.");
        router.refresh();
      }
    });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Saved searches"
          description={`Run weekly by cron (Monday 06:00 UTC) or on demand.${apify ? "" : " Without Apify, “Run now” uses demo fixtures."}`}
          action={
            isAdmin ? (
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                <Plus size={14} /> Add search
              </Button>
            ) : null
          }
        />
        <CardBody>
          {searches.length === 0 ? (
            <p className="text-[13px] text-muted">No saved searches yet. Try “Sales Development Representative” in Germany, last 7 days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {searches.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted">
                      {" "}
                      · “{s.keywords}” · {s.location} · last {s.days} days
                    </span>
                  </span>
                  {isAdmin ? (
                    <>
                      <Button size="sm" onClick={() => run(s.id)} disabled={pending}>
                        <Play size={14} /> Run now
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => save(searches.filter((x) => x.id !== s.id))} disabled={pending}>
                        <Trash2 size={14} />
                      </Button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="History" />
        <div className="overflow-x-auto px-4 pb-4">
          {scans.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">No scans yet.</p>
          ) : (
            <table className="mt-3 w-full min-w-[640px] text-[13px]">
              <caption className="sr-only">Market scan history</caption>
              <thead className="text-left text-[12px] text-muted">
                <tr>
                  <th className="py-1 font-medium">Search</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 text-right font-medium">Postings</th>
                  <th className="py-1 text-right font-medium">Companies</th>
                  <th className="py-1 text-right font-medium">Hits</th>
                  <th className="py-1 text-right font-medium">Cost</th>
                  <th className="py-1 text-right font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-1.5">
                      {s.name} {s.simulated ? <Pill tone="info">Simulated</Pill> : null}
                      {s.error ? <div className="text-[12px] text-danger-fg">{s.error}</div> : null}
                    </td>
                    <td className="py-1.5">
                      <Pill tone={s.status === "done" ? "accent" : s.status === "failed" ? "danger" : "warm"}>{s.status}</Pill>
                    </td>
                    <td className="tabular py-1.5 text-right">{s.rawJobs}</td>
                    <td className="tabular py-1.5 text-right">{s.companies}</td>
                    <td className="tabular py-1.5 text-right">{s.hits}</td>
                    <td className="tabular py-1.5 text-right">{usd(s.costUsd)}</td>
                    <td className="py-1.5 text-right text-muted">{relativeTime(s.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add a saved search" description="Searches LinkedIn jobs; matching employers are added as accounts.">
          <form
            className="space-y-3"
            action={(f) =>
              save([
                ...searches,
                {
                  id: `s_${Date.now().toString(36)}`,
                  name: String(f.get("name") || f.get("keywords")),
                  keywords: String(f.get("keywords")),
                  location: String(f.get("location")),
                  days: Number(f.get("days")) === 30 ? 30 : 7,
                },
              ])
            }
          >
            <Field label="Keywords" htmlFor="sc-k">
              <Input id="sc-k" name="keywords" required defaultValue="Sales Development Representative" />
            </Field>
            <Field label="Location" htmlFor="sc-l">
              <Input id="sc-l" name="location" required defaultValue="Germany" />
            </Field>
            <Field label="Posted in" htmlFor="sc-d">
              <Select id="sc-d" name="days" defaultValue="7">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </Select>
            </Field>
            <Field label="Name (optional)" htmlFor="sc-n">
              <Input id="sc-n" name="name" />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={pending}>
              Save search
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

export interface HubspotStatus {
  connected: boolean;
  connectedAt: string | null;
  propertiesCreatedAt: string | null;
  mapping: Record<string, string>;
  encryption: boolean;
}

export function IntegrationsSettings({ hubspot, isAdmin, accounts }: { hubspot: HubspotStatus; isAdmin: boolean; accounts: { id: string; name: string; tier: string; inHubspot: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [token, setToken] = useState("");
  const [mapping, setMapping] = useState(hubspot.mapping);
  const [selected, setSelected] = useState<string[]>(() => accounts.filter((a) => a.tier === "hot").slice(0, 5).map((a) => a.id));
  const [sep, setSep] = useState<"," | ";">(",");
  const [preview, setPreview] = useState<string | null>(null);
  const ids = selected.join(",");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Export" description="CRM-ready CSV (UTF-8 with BOM, opens cleanly in Excel) or JSON: one row per contact with company and signal columns." />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="CSV separator" value={sep} onChange={(e) => setSep(e.target.value as "," | ";")} className="h-9 w-auto">
              <option value=",">Comma separated</option>
              <option value=";">Semicolon separated (German Excel)</option>
            </Select>
            <Button asChild>
              <a href={`/api/export?format=csv&sep=${encodeURIComponent(sep)}`}>
                <Download size={14} /> CSV, all accounts
              </a>
            </Button>
            <Button asChild>
              <a href="/api/export?format=json">
                <Download size={14} /> JSON, all accounts
              </a>
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="HubSpot"
          description={hubspot.connected ? `Connected ${relativeTime(hubspot.connectedAt)}${hubspot.propertiesCreatedAt ? ` · properties created ${shortDate(hubspot.propertiesCreatedAt)}` : ""}` : "Paste a private-app token with crm.objects.companies/contacts read+write and crm.schemas write scopes."}
          action={hubspot.connected ? <Pill tone="accent">Connected</Pill> : <Pill>Not connected</Pill>}
        />
        <CardBody className="space-y-4">
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {!hubspot.encryption ? <p className="w-full text-[13px] text-danger-fg">Set ENCRYPTION_KEY in Vercel first: the token is stored encrypted (AES-256-GCM).</p> : null}
              <Input aria-label="HubSpot private-app token" type="password" placeholder={hubspot.connected ? "Replace token…" : "pat-eu1-…"} value={token} onChange={(e) => setToken(e.target.value)} className="max-w-sm" />
              <Button
                variant="primary"
                disabled={pending || token.length < 10 || !hubspot.encryption}
                onClick={() =>
                  start(async () => {
                    if (await send("/api/crm/hubspot", "POST", { token })) {
                      setToken("");
                      toast.success("HubSpot connected");
                      router.refresh();
                    }
                  })
                }
              >
                {hubspot.connected ? "Replace token" : "Connect"}
              </Button>
              {hubspot.connected ? (
                <>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await send("/api/crm/hubspot/properties", "POST");
                        if (r) {
                          toast.success(`Signalz properties: ${r.created} created, ${r.existing} already there`);
                          router.refresh();
                        }
                      })
                    }
                  >
                    Create Signalz properties
                  </Button>
                  <Button
                    variant="danger-outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (await send("/api/crm/hubspot", "DELETE")) router.refresh();
                      })
                    }
                  >
                    Disconnect
                  </Button>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-muted">Only admins can connect HubSpot.</p>
          )}

          <div>
            <div className="text-[13px] font-medium">Push accounts</div>
            <p className="text-[12px] text-muted">Matches companies by domain and contacts by e-mail or LinkedIn URL, creates or updates them, associates them and adds a note with the reasons and job links.</p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-[10px] border border-line p-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-2 py-0.5 text-[13px]">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={selected.includes(a.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, a.id] : selected.filter((x) => x !== a.id))} />
                  <span className="flex-1">{a.name}</span>
                  {a.inHubspot ? <Pill tone="accent">in HubSpot</Pill> : null}
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                disabled={pending || !selected.length}
                onClick={() =>
                  start(async () => {
                    const r = await send("/api/crm/hubspot/push", "POST", { companyIds: selected, dryRun: true });
                    if (r) setPreview(JSON.stringify(r.plans, null, 2));
                  })
                }
              >
                Dry run
              </Button>
              <Button
                variant="primary"
                disabled={pending || !selected.length || !hubspot.connected}
                onClick={() =>
                  start(async () => {
                    const r = await send("/api/crm/hubspot/push", "POST", { companyIds: selected, dryRun: false });
                    if (r) {
                      const ok = r.results.filter((x: { ok: boolean }) => x.ok).length;
                      toast[ok === r.results.length ? "success" : "error"](`Pushed ${ok} of ${r.results.length} accounts`);
                      router.refresh();
                    }
                  })
                }
              >
                <Upload size={14} /> Push to HubSpot
              </Button>
              <Button asChild variant="ghost">
                <a href={`/api/export?format=csv&sep=${encodeURIComponent(sep)}&ids=${ids}`}>Export selected (CSV)</a>
              </Button>
            </div>
          </div>

          {hubspot.connected && isAdmin ? (
            <details>
              <summary className="cursor-pointer text-[13px] font-medium">Field mapping</summary>
              <p className="mt-1 text-[12px] text-muted">Signalz column → HubSpot internal property name. Leave empty to skip a field.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {Object.keys(mapping).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-[12px]">
                    <span className="w-48 shrink-0 truncate font-mono text-muted">{k}</span>
                    <Input value={mapping[k]} onChange={(e) => setMapping({ ...mapping, [k]: e.target.value })} className="h-8 font-mono text-[12px]" />
                  </label>
                ))}
              </div>
              <Button
                className="mt-3"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (await send("/api/crm/hubspot", "PATCH", { mapping })) toast.success("Mapping saved");
                  })
                }
              >
                Save mapping
              </Button>
            </details>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {["Salesforce", "Pipedrive"].map((n) => (
          <Card key={n}>
            <CardHeader title={n} description="Push accounts and contacts" action={<Pill>Coming soon</Pill>} />
            <CardBody className="text-[13px] text-muted">Use the CSV export in the meantime.</CardBody>
          </Card>
        ))}
      </div>

      <Dialog open={preview !== null} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent title="Dry run: exact payload" description="Nothing has been sent to HubSpot." className="max-w-3xl">
          <pre className="max-h-[60vh] overflow-auto rounded-[10px] bg-surface-2 p-3 font-mono text-[12px]">{preview}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardHeader title="Audit log" description="Last 1,000 admin and account actions." />
      <div className="overflow-x-auto px-4 pb-4">
        {entries.length === 0 ? (
          <p className="py-3 text-[13px] text-muted">Nothing logged yet.</p>
        ) : (
          <table className="mt-3 w-full min-w-[640px] text-[13px]">
            <caption className="sr-only">Audit log</caption>
            <thead className="text-left text-[12px] text-muted">
              <tr>
                <th className="py-1 font-medium">When</th>
                <th className="py-1 font-medium">Who</th>
                <th className="py-1 font-medium">Action</th>
                <th className="py-1 font-medium">Target</th>
                <th className="py-1 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="py-1.5 whitespace-nowrap text-muted" title={e.at}>
                    {relativeTime(e.at)}
                  </td>
                  <td className="py-1.5">{e.userName}</td>
                  <td className="py-1.5 font-mono text-[12px]">{e.action}</td>
                  <td className="py-1.5">{e.target ?? "—"}</td>
                  <td className="max-w-[320px] truncate py-1.5 text-muted" title={e.detail ?? ""}>
                    {e.detail ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
