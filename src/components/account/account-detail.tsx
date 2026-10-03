"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Clock, Copy, ExternalLink, Lock, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, errorMessage, relativeTime } from "@/lib/format";
import type { Account, Workspace } from "@/lib/types";
import { ANGLES, BUCKET_LABELS, OUTREACH_EVENTS } from "@/lib/types";
import { Avatar, Button, Card, CompanyLogo, Pill, ScoreBar, TierPill } from "@/components/ui";

interface Cluster {
  id: string;
  division_id: string;
  open_roles: number;
  leader_roles: number;
  builder_roles: number;
  revops_roles: number;
  new_leader_days: number | null;
  crm_mentions: string[];
  flags: string[];
  cluster_score: number;
  score_breakdown: Record<string, number>;
  first_detected_at: string;
  divisions: { label: string } | null;
}

interface Posting {
  id: string;
  division_id: string | null;
  title: string;
  url: string | null;
  role_family: string | null;
  posted_at: string;
  closed_at: string | null;
  is_excluded: boolean;
  exclusion_reason: string | null;
  crm_mentions: string[];
}

interface Person {
  id: string;
  full_name: string | null;
  headline: string | null;
  current_title: string | null;
  photo_url: string | null;
  linkedin_url: string;
  persona: string | null;
  is_decision_maker: boolean;
  started_current_role_at: string | null;
  location: string | null;
  prior_tools: string[];
  previous_roles: { company?: string; title?: string; from?: string; to?: string }[];
  recent_posts: { posted_at?: string; text?: string; url?: string }[];
  mutual_connections: number | null;
  shared_history: string[];
  last_enriched_at: string | null;
}

interface OutreachEvent {
  id: string;
  event_type: string;
  angle: string | null;
  occurred_at: string;
  user_id: string;
}

interface Template {
  id: string;
  name: string;
  angle: string;
  body: string;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  roles: "Open roles in the division",
  mix: "Leader + builders mix",
  new_leader: "New sales leader",
  crm: "CRM named in job ads",
  flags: "First SDR / new region",
  velocity: "≥ 2 roles in the last 14 days",
  revops: "RevOps / enablement hire",
};

const ROLE_LABEL: Record<string, string> = {
  sales_leader: "Head of Sales",
  sdr_bdr: "SDR",
  account_executive: "AE",
  account_manager: "AM",
  revops: "RevOps",
  sales_enablement: "Enablement",
  sales_engineer: "SE",
};

const EVENT_LABEL: Record<string, string> = Object.fromEntries(OUTREACH_EVENTS.map((e) => [e.type, e.label]));

function daysSince(date: string | null) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function recommendAngle(a: Account, clusters: Cluster[]): string {
  const best = clusters[0];
  if (a.new_leader_days != null && a.new_leader_days <= 90) return "new_leader_90_days";
  if (best && best.crm_mentions.some((c) => c !== "hubspot")) return "crm_displacement";
  if (best && best.flags.includes("new_region")) return "new_region";
  if ((a.builder_roles ?? 0) >= 2) return "sdr_team_buildout";
  if (best && best.revops_roles > 0) return "revops_hire";
  return "sdr_team_buildout";
}

export function AccountDetail({
  account,
  workspace,
  onClaim,
}: {
  account: Account;
  workspace: Workspace;
  onClaim: (a: Account) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [angle, setAngle] = useState<string>("");
  const [message, setMessage] = useState("");
  const [logging, setLogging] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [cl, jp, pe, ev, tp] = await Promise.all([
      supabase
        .from("hiring_clusters")
        .select("*, divisions(label)")
        .eq("company_id", account.id)
        .eq("status", "active")
        .order("cluster_score", { ascending: false }),
      supabase.from("job_postings").select("*").eq("company_id", account.id).order("posted_at", { ascending: false }),
      supabase
        .from("people")
        .select("*")
        .eq("company_id", account.id)
        .order("is_decision_maker", { ascending: false })
        .order("started_current_role_at", { ascending: false, nullsFirst: false }),
      supabase.from("outreach_events").select("id, event_type, angle, occurred_at, user_id").eq("company_id", account.id).order("occurred_at", { ascending: false }),
      supabase.from("message_templates").select("id, name, angle, body").eq("org_id", account.org_id).eq("archived", false),
    ]);
    const err = cl.error ?? jp.error ?? pe.error ?? ev.error ?? tp.error;
    if (err) toast.error(errorMessage(err));
    setClusters((cl.data ?? []) as Cluster[]);
    setPostings((jp.data ?? []) as Posting[]);
    setPeople((pe.data ?? []) as Person[]);
    setEvents((ev.data ?? []) as OutreachEvent[]);
    setTemplates((tp.data ?? []) as Template[]);
    setLoading(false);
  }, [account.id, account.org_id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const dm = people[0] ?? null;
  const recommended = useMemo(() => recommendAngle(account, clusters), [account, clusters]);

  // Fill the template for the chosen angle with this account's facts.
  useEffect(() => {
    if (loading) return;
    const chosen = angle || recommended;
    const tpl = templates.find((t) => t.angle === chosen);
    const best = clusters[0];
    const vars: Record<string, string> = {
      first_name: dm?.full_name?.split(" ")[0] ?? "there",
      company: account.name,
      division: best?.divisions?.label ?? account.division_label ?? "your sales team",
      open_roles: String(best?.open_roles ?? account.open_roles ?? ""),
      crm: best?.crm_mentions[0] ?? account.current_crm ?? "your CRM",
      industry: account.industry ?? "your industry",
    };
    const body = tpl?.body ?? "";
    setMessage(body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? ""));
  }, [angle, recommended, templates, clusters, dm, account, loading]);

  const suppression: string[] = [];
  if (account.status === "customer") suppression.push("Already a customer");
  if (account.status === "open_opportunity") suppression.push("Open opportunity in the CRM");
  if (account.owner_id && account.owner_id !== workspace.userId) suppression.push(`Claimed by ${account.owner_name ?? "a teammate"}`);
  const lastTouch = daysSince(account.last_outreach_at);
  if (lastTouch != null && lastTouch < 14) suppression.push(`Contacted ${lastTouch === 0 ? "today" : `${lastTouch} d ago`}`);

  const windowLeft = account.new_leader_days != null ? 90 - account.new_leader_days : null;
  const mine = account.owner_id === workspace.userId;
  const claimedByOther = Boolean(account.owner_id && !mine);

  async function logEvent(type: string) {
    setLogging(type);
    const { error } = await createClient()
      .from("outreach_events")
      .insert({
        org_id: account.org_id,
        company_id: account.id,
        person_id: dm?.id ?? null,
        event_type: type,
        angle: angle || recommended,
        channel: "linkedin",
      });
    setLogging(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Logged: ${EVENT_LABEL[type] ?? type}`);
    load();
    router.refresh();
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copied. Paste it on LinkedIn, then log it here.");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
    const url = dm?.linkedin_url ?? account.contact_linkedin ?? account.linkedin_url;
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <CompanyLogo name={account.name} src={account.logo_url} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[20px] leading-tight font-semibold">{account.name}</h2>
            <TierPill tier={account.tier} />
            <Pill>{BUCKET_LABELS[account.bucket]}</Pill>
          </div>
          <div className="mt-0.5 text-[13px] text-muted">
            {[account.domain, account.industry, account.employee_count ? `${account.employee_count.toLocaleString()} employees` : null, [account.hq_city, account.hq_country].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <PriorityRing value={account.priority_score} />
          <span className="mt-1 text-[11px] text-muted">Priority</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mine ? "secondary" : "primary"}
          size="sm"
          disabled={claimedByOther}
          onClick={() => onClaim(account)}
          title={claimedByOther ? `Claimed by ${account.owner_name ?? "a teammate"}` : undefined}
        >
          {claimedByOther ? <Lock size={13} /> : <UserPlus size={13} />}
          {claimedByOther ? `Owned by ${account.owner_name ?? "teammate"}` : mine ? "Release" : "Claim"}
        </Button>
        {account.linkedin_url && (
          <a href={account.linkedin_url} target="_blank" rel="noreferrer">
            <Button size="sm">
              <ExternalLink size={13} /> Company on LinkedIn
            </Button>
          </a>
        )}
        <Button size="sm" disabled title="CRM push arrives in the next build">
          Push to CRM · soon
        </Button>
      </div>

      {/* Suppression first, in red */}
      {suppression.length > 0 && (
        <div className="flex gap-2 rounded-xl bg-danger-bg p-3 text-[13px] text-danger-fg" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Check before reaching out</div>
            <ul className="mt-0.5">
              {suppression.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Why now */}
      <Card className="p-4">
        <h3 className="text-[14px] font-semibold">Why now</h3>
        {account.reasons.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">No active hiring cluster.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {account.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-[13px]">
                <Check size={15} className="mt-0.5 shrink-0 text-ok" /> {r}
              </li>
            ))}
          </ul>
        )}
        {windowLeft != null && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
            <Clock size={14} />
            {windowLeft > 0 ? `Buying window closes in ~${windowLeft} days (new leader's first 90 days)` : "New leader is past their first 90 days"}
          </div>
        )}
      </Card>

      {/* Score breakdown */}
      <Card className="p-4">
        <h3 className="text-[14px] font-semibold">Score breakdown</h3>
        <div className="mt-3 space-y-2.5">
          {(
            [
              ["Cluster", account.cluster_score, "Hiring Cluster Index of the strongest division"],
              ["Fit", account.fit_score, "Headcount band, country, industry, current CRM, growth"],
              ["Timing", account.timing_score, "Freshness of the newest posting or leader start"],
              ["Reach", account.reach_score, "Decision maker found, active, mutuals, prior tools"],
            ] as const
          ).map(([label, v, hint]) => (
            <div key={label} title={hint}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span>{label}</span>
                <span className="tabular font-medium">{v}</span>
              </div>
              <ScoreBar value={v} />
            </div>
          ))}
        </div>
        {clusters[0] && (
          <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[13px]">
            {Object.entries(clusters[0].score_breakdown)
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-muted">{BREAKDOWN_LABELS[k] ?? k}</span>
                  <span className="tabular font-medium text-ok">+{v}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {/* Hiring clusters */}
      <section>
        <h3 className="mb-2 text-[14px] font-semibold">Hiring clusters</h3>
        {loading ? (
          <div className="skeleton h-28" />
        ) : clusters.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">No active cluster.</Card>
        ) : (
          <div className="space-y-2">
            {clusters.map((c) => {
              const roles = postings.filter((p) => p.division_id === c.division_id && !p.is_excluded && !p.closed_at);
              const chips = Object.entries(
                roles.reduce<Record<string, number>>((m, p) => {
                  const l = ROLE_LABEL[p.role_family ?? ""] ?? "Other";
                  m[l] = (m[l] ?? 0) + 1;
                  return m;
                }, {}),
              );
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{c.divisions?.label ?? "Division"}</div>
                    <span className="tabular text-[13px] text-muted">
                      Index <span className="font-semibold text-fg">{c.cluster_score}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map(([l, n]) => (
                      <Pill key={l} className="bg-accent-soft text-accent">
                        {l}
                        {n > 1 ? ` ×${n}` : ""}
                      </Pill>
                    ))}
                    {c.crm_mentions.map((m) => (
                      <Pill key={m}>mentions {m}</Pill>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 text-[13px]">
                    {roles.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                            {p.title}
                          </a>
                        ) : (
                          <span className="truncate">{p.title}</span>
                        )}
                        <span className="shrink-0 text-muted">{relativeTime(p.posted_at)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
        {postings.some((p) => p.is_excluded) && (
          <details className="group mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-muted">
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              Not counted ({postings.filter((p) => p.is_excluded).length})
            </summary>
            <ul className="mt-2 space-y-1">
              {postings
                .filter((p) => p.is_excluded)
                .map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="truncate">{p.title}</span>
                    <span className="shrink-0 text-muted">{p.exclusion_reason ?? "excluded"}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      {/* People */}
      <section>
        <h3 className="mb-2 text-[14px] font-semibold">Who to contact</h3>
        {loading ? (
          <div className="skeleton h-24" />
        ) : people.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">No people researched yet.</Card>
        ) : (
          <div className="space-y-2">
            {people.map((p, i) => {
              const days = daysSince(p.started_current_role_at);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.full_name} src={p.photo_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {p.full_name ?? "Unknown"}
                        </a>
                        {i === 0 && p.is_decision_maker && <Pill className="bg-accent-soft text-accent">Decision maker</Pill>}
                      </div>
                      <div className="text-[13px] text-muted">{p.current_title ?? p.headline}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12px]">
                        {days != null && days <= 365 && <Pill>Started {days} d ago</Pill>}
                        {p.prior_tools.map((t) => (
                          <Pill key={t} className={t === "hubspot" ? "bg-ok/15 text-ok" : ""}>
                            used {t}
                          </Pill>
                        ))}
                        {(p.mutual_connections ?? 0) > 0 && <Pill>{p.mutual_connections} mutuals</Pill>}
                      </div>
                      {p.recent_posts.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[12px]">
                          {p.recent_posts.slice(0, 3).map((post, j) => (
                            <li key={j} className="line-clamp-2 text-muted">
                              {post.posted_at && <span className="text-fg">{relativeTime(post.posted_at)}: </span>}
                              {post.text}
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.last_enriched_at && (
                        <div className="mt-2 text-[11px] text-muted">Source: LinkedIn (public profile) · {relativeTime(p.last_enriched_at)}</div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Outreach */}
      <Card className="p-4">
        <h3 className="text-[14px] font-semibold">Outreach</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ANGLES.map((a) => {
            const active = (angle || recommended) === a.value;
            return (
              <button
                key={a.value}
                onClick={() => setAngle(a.value)}
                className={cn(
                  "h-7 rounded-lg border px-2.5 text-[12px] font-medium",
                  active ? "border-accent bg-accent-soft text-accent" : "border-line hover:bg-surface-2",
                )}
              >
                {a.label}
                {a.value === recommended && " ★"}
              </button>
            );
          })}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="No template for this angle yet. Write your opener here."
          className="mt-3 w-full resize-y rounded-lg border border-line bg-surface p-3 text-[13px] focus:border-accent focus:outline-none"
          aria-label="Opener"
        />
        <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
          <span>★ recommended angle</span>
          <span className={cn("tabular", message.length > 300 && "text-danger-fg")}>{message.length}/300 for a connection note</span>
        </div>
        <Button variant="primary" size="sm" className="mt-2" onClick={copyAndOpen} disabled={!message}>
          <Copy size={13} /> Copy &amp; open LinkedIn
        </Button>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-[12px] font-medium text-muted">Log what you did</div>
          <div className="flex flex-wrap gap-1.5">
            {OUTREACH_EVENTS.map((e) => (
              <Button key={e.type} size="sm" onClick={() => logEvent(e.type)} disabled={logging !== null}>
                {logging === e.type ? "Logging…" : e.label}
              </Button>
            ))}
          </div>
        </div>
        {events.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>
                  {EVENT_LABEL[e.event_type] ?? e.event_type.replace(/_/g, " ")}
                  {e.angle && <span className="text-muted"> · {ANGLES.find((a) => a.value === e.angle)?.label ?? e.angle}</span>}
                </span>
                <span className="text-muted">{relativeTime(e.occurred_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PriorityRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" role="img" aria-label={`Priority ${value} of 100`}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30.5" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text)" className="tabular">
        {value}
      </text>
    </svg>
  );
}
