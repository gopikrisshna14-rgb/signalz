"use client";

import {
  AlertOctagon,
  Briefcase,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Hourglass,
  Link2,
  Sparkles,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Avatar, Logo, Pill, TierPill } from "@/components/ui/pills";
import { Bar, FactorList, PriorityRing } from "@/components/ui/score";
import { Tooltip } from "@/components/ui/tooltip";
import type { AccountDetail } from "@/lib/account-detail";
import { companyRecord, COMPANY_COLUMNS } from "@/lib/export";
import { countryName, daysAgo, relativeTime, shortDate } from "@/lib/format";
import { CRM_LABEL } from "@/lib/pipeline/rules";
import { divisionPhrase, openerFromTemplate, type Opener } from "@/lib/templates";
import { ANGLE_LABEL, BUCKET_LABEL, OUTREACH_LABEL, ROLE_FAMILY_LABEL, type Angle, type Company, type OutreachType, type Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAccountActions } from "./use-actions";

const ANGLES = Object.keys(ANGLE_LABEL) as Angle[];
const LOG_TYPES = Object.keys(OUTREACH_LABEL) as OutreachType[];

function Section({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <Card id={id}>
      <CardHeader title={title} action={action} />
      <CardBody className="pt-3">{children}</CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Header + suppression                                                */
/* ------------------------------------------------------------------ */

function Header({ d, onClaim, onRelease, onStatus }: { d: AccountDetail; onClaim: () => void; onRelease: () => void; onStatus: (s: Company["status"]) => void }) {
  const c = d.company;
  const s = c.score!;
  const mine = c.owner?.userId === d.viewer.id;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Logo name={c.name} src={c.logoUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] leading-tight font-semibold">{c.name}</h1>
          <TierPill tier={s.tier} />
          <Pill>{BUCKET_LABEL[s.bucket]}</Pill>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {c.domain ? (
            <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="hover:text-fg hover:underline">
              {c.domain}
            </a>
          ) : null}
          {c.linkedinUrl ? (
            <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg hover:underline">
              LinkedIn <ExternalLink size={12} />
            </a>
          ) : null}
          <span>{[c.industry, c.headcount ? `${c.headcount.toLocaleString("en")} employees` : null, c.city, countryName(c.country)].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Owner:</span>
          {c.owner ? <span className="font-medium">{mine ? "You" : c.owner.name}</span> : <span className="text-muted">Unclaimed</span>}
          {!c.owner ? (
            <Button size="sm" variant="primary" onClick={onClaim}>
              <Flag size={14} /> Claim
            </Button>
          ) : mine || d.viewer.isAdmin ? (
            <Button size="sm" onClick={onRelease}>
              <UserX size={14} /> Release
            </Button>
          ) : null}
          <Select aria-label="Account status" value={c.status} onChange={(e) => onStatus(e.target.value as Company["status"])} className="h-8 w-auto text-[13px]">
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="open_opportunity">Open opportunity</option>
            <option value="disqualified">Disqualified</option>
          </Select>
        </div>
      </div>
      <PriorityRing value={s.priority} />
    </div>
  );
}

function Suppression({ d }: { d: AccountDetail }) {
  const c = d.company;
  const items = [...(c.score?.suppression ?? [])];
  if (c.owner && c.owner.userId !== d.viewer.id) items.unshift(`Claimed by ${c.owner.name}`);
  if (!items.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger-fg/30 bg-danger-bg p-3 text-danger-fg">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <AlertOctagon size={16} aria-hidden /> Check before you reach out
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[13px]">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Why now + score                                                     */
/* ------------------------------------------------------------------ */

function WhyNow({ d }: { d: AccountDetail }) {
  const c = d.company;
  const s = c.score!;
  const leader = c.clusters.map((x) => x.newLeader).find(Boolean) ?? null;
  const left = leader ? d.settings.leaderTenureDays - leader.days : null;
  return (
    <Section title="Why now">
      {s.reasons.length ? (
        <>
          <p className="text-[15px] font-medium">{s.reasons[0]}</p>
          <ul className="mt-3 space-y-1.5">
            {s.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[13px]">
                <Check size={15} className="mt-0.5 shrink-0 text-ok" aria-hidden /> {r}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13px] text-muted">No hiring signal in the last {d.settings.clusterWindowDays} days.</p>
      )}
      {leader && left !== null && left >= 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-[10px] bg-accent-soft p-3">
          <Hourglass size={18} className="shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Buying window: {left} days left</div>
            <div className="text-[12px] text-muted">
              {leader.name} is {leader.days} of {d.settings.leaderTenureDays} days into the role. New leaders pick tools in their first months.
            </div>
            <Bar value={(leader.days / d.settings.leaderTenureDays) * 100} className="mt-2" />
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function ScoreBreakdown({ c }: { c: Company }) {
  const s = c.score!;
  const parts = [
    { key: "cluster", label: "Hiring cluster", v: s.cluster, f: s.breakdown.cluster },
    { key: "fit", label: "ICP fit", v: s.fit, f: s.breakdown.fit },
    { key: "timing", label: "Timing", v: s.timing, f: s.breakdown.timing },
    { key: "reach", label: "Reach", v: s.reach, f: s.breakdown.reach },
  ];
  const [open, setOpen] = useState<string | null>("cluster");
  return (
    <Section title="Score breakdown" action={<span className="tabular text-[13px] text-muted">Priority {s.priority}</span>}>
      <div className="space-y-2">
        {parts.map((p) => (
          <div key={p.key}>
            <button className="flex w-full items-center gap-3 text-left" aria-expanded={open === p.key} onClick={() => setOpen(open === p.key ? null : p.key)}>
              <span className="w-28 shrink-0 text-[13px]">{p.label}</span>
              <Bar value={p.v} className="flex-1" />
              <span className="tabular w-8 text-right text-[13px] font-semibold">{p.v}</span>
            </button>
            {open === p.key ? (
              <div className="mt-2 mb-3 ml-1 rounded-[10px] bg-surface-2 p-3">
                <FactorList factors={p.f} />
              </div>
            ) : null}
          </div>
        ))}
        {s.breakdown.boost.length ? (
          <div className="pt-2">
            <div className="mb-1 text-[12px] font-medium text-muted">Boosters (raise priority only)</div>
            <FactorList factors={s.breakdown.boost} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Clusters                                                            */
/* ------------------------------------------------------------------ */

function Heat({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" role="img" aria-label={`Postings per week, last 12 weeks: ${weeks.join(", ")}`}>
        {weeks.map((w, i) => (
          <Tooltip key={i} content={`${12 - i === 1 ? "This week" : `${12 - i - 1} weeks ago`}: ${w} posting${w === 1 ? "" : "s"}`}>
            <span className="size-3 rounded-[3px] border border-line" style={{ background: w ? `color-mix(in oklab, var(--accent) ${25 + (w / max) * 75}%, transparent)` : "var(--surface-2)" }} />
          </Tooltip>
        ))}
      </div>
      <span className="text-[11px] text-muted">12 weeks</span>
    </div>
  );
}

function Clusters({ d }: { d: AccountDetail }) {
  const c = d.company;
  const inCluster = new Set(c.clusters.flatMap((x) => x.jobIds));
  const notCounted = c.jobs
    .filter((j) => !inCluster.has(j.id))
    .map((j) => ({ j, reason: d.notCounted[j.id] ?? "Not enough roles in this division to form a cluster" }));
  return (
    <Section title={`Hiring clusters (${c.clusters.length})`}>
      {c.clusters.length === 0 ? <p className="text-[13px] text-muted">No division has enough open sales roles right now.</p> : null}
      <div className="space-y-4">
        {c.clusters.map((cl) => (
          <div key={cl.key} className="rounded-[10px] border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold">{cl.label}</div>
                <div className="text-[12px] text-muted">
                  {cl.openRoles} open role{cl.openRoles === 1 ? "" : "s"}
                  {cl.newLeader ? ` · new leader ${cl.newLeader.name}, ${cl.newLeader.days} days in` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="tabular text-[20px] font-semibold">{cl.index}</div>
                <div className="text-[11px] text-muted">Cluster index</div>
              </div>
            </div>
            <div className="mt-2">
              <Heat weeks={d.heat[cl.key] ?? []} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {c.jobs
                .filter((j) => cl.jobIds.includes(j.id))
                .map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Pill tone="accent">{ROLE_FAMILY_LABEL[j.cls.roleFamily]}</Pill>
                    {j.url ? (
                      <a href={j.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">
                        {j.title}
                      </a>
                    ) : (
                      <span className="min-w-0 truncate">{j.title}</span>
                    )}
                    <span className="text-[12px] text-muted">
                      {j.location} · posted {shortDate(j.postedAt ?? j.firstSeenAt)}
                    </span>
                  </li>
                ))}
            </ul>
            {cl.crmMentions.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-muted">CRM in ads:</span>
                {cl.crmMentions.map((m) => (
                  <Pill key={m} tone={m === d.settings.ownProduct ? "info" : "warm"}>
                    {CRM_LABEL[m] ?? m}
                  </Pill>
                ))}
              </div>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-[12px] text-muted hover:text-fg">How the index is built</summary>
              <div className="mt-2">
                <FactorList factors={cl.breakdown} total={cl.index} />
              </div>
            </details>
          </div>
        ))}
      </div>
      {notCounted.length ? (
        <details className="mt-4 rounded-[10px] bg-surface-2 p-3">
          <summary className="cursor-pointer text-[13px] font-medium">Not counted ({notCounted.length})</summary>
          <ul className="mt-2 space-y-2">
            {notCounted.map(({ j, reason }) => (
              <li key={j.id} className="text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="line-through decoration-muted">{j.title}</span>
                  <span className="text-[12px] text-muted">{j.location}</span>
                </div>
                <div className="text-[12px] text-muted">{reason}</div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

function PersonCard({ p, own, primary }: { p: Person; own: string; primary?: boolean }) {
  const days = daysAgo(p.roleStartedAt);
  return (
    <div className={cn("rounded-[10px] border border-line p-3", primary && "border-accent/50 bg-accent-soft/40")}>
      <div className="flex items-start gap-3">
        <Avatar name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">{p.name}</span>
            <Pill tone={primary ? "accent" : "neutral"}>{p.cls.persona}</Pill>
            {primary ? <Pill tone="accent">Contact first</Pill> : null}
          </div>
          <div className="text-[13px]">{p.title}</div>
          <div className="text-[12px] text-muted">
            {days !== null ? `${days} days in the role` : "Start date unknown"}
            {p.location ? ` · ${p.location}` : ""}
          </div>
        </div>
        {p.linkedinUrl ? (
          <Button asChild size="sm" variant="ghost">
            <a href={p.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`${p.name} on LinkedIn`}>
              <ExternalLink size={14} />
            </a>
          </Button>
        ) : null}
      </div>
      {p.previousRoles.length ? (
        <div className="mt-3">
          <div className="text-[12px] font-medium text-muted">Previously</div>
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {p.previousRoles.slice(0, 3).map((r, i) => (
              <li key={i}>
                {r.title}, {r.company}{" "}
                <span className="text-[12px] text-muted">
                  {r.from?.slice(0, 4) ?? "?"}–{r.to?.slice(0, 4) ?? "today"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.cls.priorTools.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-muted">Tools used before:</span>
          {p.cls.priorTools.map((t) => (
            <Pill key={t} tone={t === own ? "accent" : "neutral"} className={t === own ? "ring-1 ring-accent" : ""}>
              {CRM_LABEL[t] ?? t}
              {t === own ? " ★" : ""}
            </Pill>
          ))}
        </div>
      ) : null}
      {p.posts.length ? (
        <div className="mt-3">
          <div className="text-[12px] font-medium text-muted">Last posts</div>
          <ul className="mt-1 space-y-1.5">
            {p.posts.slice(0, 3).map((post, i) => (
              <li key={i} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px]">
                <span className="line-clamp-2">“{post.text}”</span>
                <span className="text-[11px] text-muted">
                  {shortDate(post.at)}
                  {post.url ? (
                    <>
                      {" · "}
                      <a href={post.url} target="_blank" rel="noreferrer" className="hover:underline">
                        open
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.mutualConnections || p.sharedHistory || p.schools.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-muted">Warm paths:</span>
          {p.mutualConnections ? (
            <Pill>
              <Users size={12} /> {p.mutualConnections} mutual
            </Pill>
          ) : null}
          {p.sharedHistory ? (
            <Pill>
              <Link2 size={12} /> {p.sharedHistory}
            </Pill>
          ) : null}
          {p.schools.map((s) => (
            <Pill key={s}>{s}</Pill>
          ))}
        </div>
      ) : null}
      <div className="mt-3 text-[11px] text-muted">
        Source: {p.source === "demo" ? "demo data" : p.source} · scraped {shortDate(p.scrapedAt)}
      </div>
    </div>
  );
}

function People({ d }: { d: AccountDetail }) {
  const c = d.company;
  const dm = c.people.find((p) => p.id === c.score?.decisionMakerId) ?? null;
  const rest = c.people.filter((p) => p !== dm);
  return (
    <Section title="Who to contact">
      {!dm ? <p className="text-[13px] text-muted">No contact found yet. Research the decision maker’s LinkedIn profile to add them.</p> : null}
      <div className="space-y-3">
        {dm ? <PersonCard p={dm} own={d.settings.ownProduct} primary /> : null}
        {rest.map((p) => (
          <PersonCard key={p.id} p={p} own={d.settings.ownProduct} />
        ))}
      </div>
      <div className="mt-3 text-[12px] text-muted">
        Current stack:{" "}
        {c.score?.crmNamed.length ? c.score.crmNamed.map((n) => CRM_LABEL[n] ?? n).join(", ") : "no CRM named in job ads"}
        {c.crm.detected ? ` · detected: ${CRM_LABEL[c.crm.detected] ?? c.crm.detected}` : ""}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Outreach                                                            */
/* ------------------------------------------------------------------ */

function OutreachPanel({ d, onLog }: { d: AccountDetail; onLog: (t: OutreachType, angle: Angle, personId: string | null) => void }) {
  const c = d.company;
  const dm = c.people.find((p) => p.id === c.score?.decisionMakerId) ?? null;
  const [angle, setAngle] = useState<Angle>(c.score!.angle);
  const [kind, setKind] = useState<"connectionNote" | "message" | "email">("connectionNote");
  const [ai, setAi] = useState<Opener | null>(null);
  const [loading, setLoading] = useState(false);
  const opener = useMemo(() => (ai && ai.angle === angle ? ai : openerFromTemplate(d.templates, angle, c, dm, d.settings.dataSourceLine)), [ai, angle, d, c, dm]);
  const text = kind === "email" ? `Subject: ${opener.emailSubject}\n\n${opener.emailBody}` : opener[kind];
  const limit = kind === "connectionNote" ? 300 : kind === "message" ? 700 : null;
  const blockedByOther = Boolean(c.owner && c.owner.userId !== d.viewer.id);

  async function writeWithAi() {
    setLoading(true);
    const res = await fetch("/api/opener", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: c.id, personId: dm?.id ?? null, angle }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return toast.error(data.message ?? "Could not write the opener");
    setAi(data.opener);
    if (data.opener.source === "template") toast.message("Claude declined; showing the template instead");
  }

  async function copyAndOpen() {
    await navigator.clipboard.writeText(text);
    toast.success("Copied. Paste it on LinkedIn and send it yourself.");
    const url = dm?.linkedinUrl ?? c.linkedinUrl;
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <Section title="Outreach" id="outreach">
      <div className="text-[12px] font-medium text-muted">Angle</div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {ANGLES.map((a) => {
          const st = d.angleStats[a];
          return (
            <button
              key={a}
              onClick={() => setAngle(a)}
              aria-pressed={angle === a}
              className={cn("rounded-[10px] border border-line p-2 text-left text-[13px] hover:bg-hover", angle === a && "border-accent ring-1 ring-accent")}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {ANGLE_LABEL[a]}
                {a === c.score!.angle ? <Pill tone="accent">Recommended</Pill> : null}
              </div>
              <div className="tabular text-[12px] text-muted">{st.rate === null ? "Not used yet" : `${Math.round(st.rate * 100)} % replied (${st.replied}/${st.sent}) in this workspace`}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-muted">Talk about {divisionPhrase(c)}, not the whole company.</p>

      <div className="mt-3 flex items-center gap-1 border-b border-line" role="tablist" aria-label="Message type">
        {(
          [
            ["connectionNote", "Connection note"],
            ["message", "First message"],
            ["email", "E-mail"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("-mb-px border-b-2 border-transparent px-2.5 py-1.5 text-[13px] text-muted", kind === k && "border-accent text-fg")}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted">{opener.source === "claude" ? "Written by Claude" : d.aiEnabled ? "From template" : "From template (no AI key set)"}</span>
      </div>
      <pre className="mt-2 rounded-[10px] bg-surface-2 p-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>
      {limit ? <div className={cn("tabular mt-1 text-right text-[11px]", text.length > limit ? "text-danger-fg" : "text-muted")}>{text.length}/{limit}</div> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" onClick={copyAndOpen} disabled={blockedByOther}>
          <Copy size={14} /> Copy &amp; open LinkedIn
        </Button>
        {d.aiEnabled ? (
          <Button onClick={writeWithAi} disabled={loading}>
            <Sparkles size={14} /> {loading ? "Writing…" : "Write with Claude"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-[12px] text-muted">Signalz never sends anything on LinkedIn. You send it, then log the step below.</p>

      <div className="mt-4 text-[12px] font-medium text-muted">Log a step{dm ? ` with ${dm.name}` : ""}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LOG_TYPES.map((t) => (
          <Button key={t} size="sm" onClick={() => onLog(t, angle, dm?.id ?? null)} disabled={blockedByOther}>
            {OUTREACH_LABEL[t]}
          </Button>
        ))}
      </div>
      {blockedByOther ? <p className="mt-2 text-[12px] text-danger-fg">Claimed by {c.owner!.name}: only they can log outreach.</p> : null}

      <div className="mt-4 text-[12px] font-medium text-muted">Timeline</div>
      {d.outreach.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted">No outreach logged yet.</p>
      ) : (
        <ol className="mt-2 space-y-2 border-l border-line pl-4">
          {d.outreach.map((e) => (
            <li key={e.id} className="relative text-[13px]">
              <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden />
              <span className="font-medium">{OUTREACH_LABEL[e.type]}</span>
              {e.personName ? ` · ${e.personName}` : ""}
              {e.angle ? <span className="text-muted"> · {ANGLE_LABEL[e.angle]}</span> : null}
              <div className="text-[12px] text-muted">
                {e.userName} · {relativeTime(e.at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* CRM preview                                                         */
/* ------------------------------------------------------------------ */

function CrmPreview({ d }: { d: AccountDetail }) {
  const rec = companyRecord(d.company);
  return (
    <Section
      title="CRM export preview"
      action={
        <div className="flex gap-1.5">
          <Button asChild size="sm">
            <a href={`/api/export?format=csv&ids=${d.company.id}`}>
              <Download size={14} /> CSV
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={`/api/export?format=json&ids=${d.company.id}`}>JSON</a>
          </Button>
        </div>
      }
    >
      <dl className="grid grid-cols-[minmax(0,180px)_1fr] gap-x-3 gap-y-1 text-[12px]">
        {COMPANY_COLUMNS.map((k) => (
          <div key={k} className="contents">
            <dt className="truncate font-mono text-muted">{k}</dt>
            <dd className="min-w-0 truncate">{rec[k] === null || rec[k] === "" ? <span className="text-muted">—</span> : String(rec[k])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] text-muted">
        {d.company.crm.hubspotCompanyId ? `In HubSpot (company ${d.company.crm.hubspotCompanyId}).` : d.hubspotConnected ? "Push to HubSpot from Settings → Integrations." : "Connect HubSpot in Settings → Integrations to push accounts."}
        {d.company.crm.exportedAt ? ` Last exported ${relativeTime(d.company.crm.exportedAt)}.` : ""}
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function AccountDetailView({ detail, compact }: { detail: AccountDetail; compact?: boolean }) {
  const router = useRouter();
  const [d, setD] = useState(detail);
  useEffect(() => setD(detail), [detail]);
  const refresh = async () => {
    const r = await fetch(`/api/accounts/${d.company.id}`);
    if (r.ok) setD(await r.json());
    router.refresh();
  };
  const actions = useAccountActions({
    me: { id: d.viewer.id, name: d.viewer.name },
    onOptimistic: (_id, patch) => {
      if (patch.owner !== undefined) setD((x) => ({ ...x, company: { ...x.company, owner: patch.owner ? { ...patch.owner, claimedAt: new Date().toISOString() } : null } }));
      setTimeout(refresh, 400);
    },
  });
  const c = d.company;
  if (!c.score) return <p className="text-[13px] text-muted">This account has not been scored yet.</p>;

  async function setStatus(status: Company["status"]) {
    const r = await fetch(`/api/accounts/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) toast.error("Could not change status");
    else toast.success("Status updated");
    void refresh();
  }

  return (
    <div className="space-y-4">
      <Header d={d} onClaim={() => void actions.claim(c.id, c.name)} onRelease={() => void actions.release(c.id, c.name)} onStatus={setStatus} />
      <Suppression d={d} />
      <div className={cn("grid gap-4", !compact && "lg:grid-cols-2")}>
        <div className="space-y-4">
          <WhyNow d={d} />
          <People d={d} />
          <ScoreBreakdown c={c} />
        </div>
        <div className="space-y-4">
          <OutreachPanel d={d} onLog={(t, angle, personId) => void actions.log(c.id, c.name, t, { angle, personId }).then(refresh)} />
          <Clusters d={d} />
          <CrmPreview d={d} />
        </div>
      </div>
      {compact ? (
        <Link href={`/accounts/${c.id}`} className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
          <Briefcase size={14} /> Open full page
        </Link>
      ) : null}
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <CalendarClock size={12} /> Scored {relativeTime(c.score.computedAt)} · enriched {relativeTime(c.enrichedAt)}
      </p>
    </div>
  );
}
