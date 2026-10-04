"use client";

import { Check, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Slider } from "@/components/ui/misc";
import { safeRegex } from "@/lib/pipeline/rules";
import type { JobFunction, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

const FUNCTIONS: { v: JobFunction; l: string }[] = [
  { v: "sales", l: "Sales" },
  { v: "revops", l: "RevOps" },
  { v: "marketing", l: "Marketing" },
  { v: "customer_success", l: "Customer Success" },
];
const WEIGHTS = [
  { k: "cluster", l: "Hiring cluster" },
  { k: "fit", l: "ICP fit" },
  { k: "timing", l: "Timing" },
  { k: "reach", l: "Reach" },
] as const;

const list = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function IcpSettings({ settings, isAdmin }: { settings: Settings; isAdmin: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [countries, setCountries] = useState(settings.countries.join(", "));
  const [industries, setIndustries] = useState(settings.industries.join(", "));
  const [exclusions, setExclusions] = useState(settings.exclusions.join("\n"));
  const [weights, setWeights] = useState(() => Object.fromEntries(WEIGHTS.map((w) => [w.k, Math.round(settings.weights[w.k] * 100)])) as Record<(typeof WEIGHTS)[number]["k"], number>);
  const [probe, setProbe] = useState("Sales Associate, Store Berlin");
  const [pending, start] = useTransition();
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const patterns = exclusions
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const invalid = patterns.filter((p) => !safeRegex(p));
  const hit = useMemo(() => patterns.find((p) => safeRegex(p)?.test(probe)) ?? null, [patterns, probe]);
  const dis = !isAdmin;

  function save() {
    start(async () => {
      const payload: Partial<Settings> = {
        countries: list(countries).map((c) => c.toUpperCase()),
        industries: list(industries),
        headcountMin: s.headcountMin,
        headcountMax: s.headcountMax,
        functions: s.functions,
        ownProduct: s.ownProduct,
        clusterWindowDays: s.clusterWindowDays,
        minClusterRoles: s.minClusterRoles,
        leaderTenureDays: s.leaderTenureDays,
        hotThreshold: s.hotThreshold,
        warmThreshold: s.warmThreshold,
        exclusions: patterns,
        weights: { cluster: weights.cluster / 100, fit: weights.fit / 100, timing: weights.timing / 100, reach: weights.reach / 100 },
      };
      const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.message ?? "Could not save");
      toast.success("Saved. Re-score all to apply it to existing accounts.", { action: { label: "Re-score now", onClick: () => rescore() } });
      router.refresh();
    });
  }

  function rescore() {
    start(async () => {
      const t = toast.loading("Re-scoring all accounts…");
      const res = await fetch("/api/rescore", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      toast.dismiss(t);
      if (res.ok) toast.success(`Re-scored ${data.accounts} accounts`);
      else toast.error(data.message ?? "Re-score failed");
      router.refresh();
    });
  }

  const num = (k: keyof Settings, min: number, max: number, label: string, hint?: string) => (
    <Field label={label} htmlFor={`icp-${k}`} hint={hint}>
      <Input id={`icp-${k}`} type="number" min={min} max={max} disabled={dis} value={s[k] as number} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
    </Field>
  );

  return (
    <div className="space-y-4">
      {!isAdmin ? <p className="rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] text-muted">Only admins can change ICP and scoring.</p> : null}
      <Card>
        <CardHeader title="Ideal customer profile" description="Drives the ICP fit score." />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Target countries" htmlFor="icp-countries" hint="ISO codes, comma separated">
            <Input id="icp-countries" value={countries} disabled={dis} onChange={(e) => setCountries(e.target.value)} />
          </Field>
          <Field label="Target industries" htmlFor="icp-industries" hint="Empty = any industry">
            <Input id="icp-industries" value={industries} disabled={dis} onChange={(e) => setIndustries(e.target.value)} placeholder="Software, Retail" />
          </Field>
          {num("headcountMin", 1, 1_000_000, "Headcount from")}
          {num("headcountMax", 1, 1_000_000, "Headcount to")}
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium">Target functions</legend>
            <div className="flex flex-wrap gap-3">
              {FUNCTIONS.map((f) => (
                <label key={f.v} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    disabled={dis}
                    className="size-4 accent-[var(--accent)]"
                    checked={s.functions.includes(f.v)}
                    onChange={(e) => setS({ ...s, functions: e.target.checked ? [...s.functions, f.v] : s.functions.filter((x) => x !== f.v) })}
                  />
                  {f.l}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Your product (CRM)" htmlFor="icp-own" hint="Accounts already using it are routed to Existing customer.">
            <Select id="icp-own" value={s.ownProduct} disabled={dis} onChange={(e) => setS({ ...s, ownProduct: e.target.value })}>
              <option value="hubspot">HubSpot</option>
              <option value="salesforce">Salesforce</option>
              <option value="pipedrive">Pipedrive</option>
              <option value="dynamics">Microsoft Dynamics</option>
              <option value="zoho">Zoho</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Clusters and timing" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          {num("clusterWindowDays", 7, 180, "Cluster window (days)")}
          {num("minClusterRoles", 1, 10, "Min roles per cluster")}
          {num("leaderTenureDays", 14, 365, "New-leader tenure (days)")}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Priority weights" description="Must add up to 100 %." action={<span className={cn("tabular text-[13px] font-semibold", sum === 100 ? "text-ok" : "text-danger-fg")}>{sum} %</span>} />
        <CardBody className="space-y-4">
          {WEIGHTS.map((w) => (
            <div key={w.k} className="grid grid-cols-[120px_1fr_48px] items-center gap-3">
              <span className="text-[13px]">{w.l}</span>
              <Slider label={`${w.l} weight`} value={weights[w.k]} onChange={(v) => !dis && setWeights({ ...weights, [w.k]: v })} />
              <span className="tabular text-right text-[13px]">{weights[w.k]} %</span>
            </div>
          ))}
          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            {num("hotThreshold", 1, 100, "Hot from priority")}
            {num("warmThreshold", 1, 100, "Warm from priority")}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exclusions" description="Case-insensitive regular expressions on the job title. Matching roles are shown under “Not counted”." />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <Field label="Patterns (one per line)" htmlFor="icp-ex" hint={invalid.length ? <span className="text-danger-fg">Invalid: {invalid.join(", ")}</span> : `${patterns.length} patterns`}>
            <Textarea id="icp-ex" className="min-h-60 font-mono text-[12px]" value={exclusions} disabled={dis} onChange={(e) => setExclusions(e.target.value)} />
          </Field>
          <div>
            <Field label="Live tester" htmlFor="icp-probe" hint="Type a job title to see whether it is excluded.">
              <Input id="icp-probe" value={probe} onChange={(e) => setProbe(e.target.value)} />
            </Field>
            <div role="status" className={cn("mt-2 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px]", hit ? "bg-danger-bg text-danger-fg" : "bg-accent-soft text-accent")}>
              {hit ? <X size={14} aria-hidden /> : <Check size={14} aria-hidden />}
              {hit ? (
                <span>
                  Excluded by <code className="font-mono">{hit}</code>
                </span>
              ) : (
                "Counts towards a cluster"
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
              {["Sales Associate, Store Berlin", "Key Account Manager Retail", "AE Retail Partnerships", "Kassierer (m/w/d)", "Call Center Agent"].map((t) => (
                <button key={t} type="button" className="rounded-md bg-surface-2 px-2 py-0.5 hover:bg-hover" onClick={() => setProbe(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={save} disabled={pending || sum !== 100 || invalid.length > 0}>
            Save
          </Button>
          <Button onClick={rescore} disabled={pending}>
            <RefreshCw size={14} /> Re-score all
          </Button>
          {sum !== 100 ? <span className="self-center text-[13px] text-danger-fg">Weights add up to {sum} %, not 100 %.</span> : null}
        </div>
      ) : null}
    </div>
  );
}
