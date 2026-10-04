import { CRM_LABEL } from "@/lib/pipeline/rules";
import { BUCKET_LABEL, type Company, type Person } from "@/lib/types";

const DAY = 86_400_000;

export const COMPANY_COLUMNS = [
  "name",
  "domain",
  "linkedin_url",
  "industry",
  "number_of_employees",
  "country",
  "city",
  "signal_priority",
  "signal_tier",
  "signal_bucket",
  "hiring_cluster_index",
  "icp_fit",
  "hiring_division",
  "open_sales_roles",
  "new_leader_days_in_role",
  "signal_top_reason",
  "signal_reasons",
  "signal_owner",
] as const;

export const CONTACT_COLUMNS = [
  "first_name",
  "last_name",
  "job_title",
  "email",
  "linkedin_url",
  "country",
  "persona",
  "role_start_date",
  "days_in_role",
  "prior_tools",
] as const;

export type CompanyRecord = Record<(typeof COMPANY_COLUMNS)[number], string | number | null>;
export type ContactRecord = Record<(typeof CONTACT_COLUMNS)[number], string | number | null>;

export function companyRecord(c: Company): CompanyRecord {
  const s = c.score;
  const top = c.clusters[0];
  const leaderDays = top?.newLeader?.days ?? c.clusters.find((x) => x.newLeader)?.newLeader?.days ?? null;
  return {
    name: c.name,
    domain: c.domain,
    linkedin_url: c.linkedinUrl,
    industry: c.industry,
    number_of_employees: c.headcount,
    country: c.country,
    city: c.city,
    signal_priority: s?.priority ?? null,
    signal_tier: s ? s.tier[0].toUpperCase() + s.tier.slice(1) : null,
    signal_bucket: s ? BUCKET_LABEL[s.bucket] : null,
    hiring_cluster_index: s?.cluster ?? null,
    icp_fit: s?.fit ?? null,
    hiring_division: top?.label ?? null,
    open_sales_roles: c.clusters.reduce((a, x) => a + x.openRoles, 0),
    new_leader_days_in_role: leaderDays,
    signal_top_reason: s?.reasons[0] ?? null,
    signal_reasons: s?.reasons.join(" | ") ?? null,
    signal_owner: c.owner?.name ?? null,
  };
}

export function contactRecord(p: Person, now = new Date()): ContactRecord {
  const days = p.roleStartedAt ? Math.floor((now.getTime() - Date.parse(p.roleStartedAt)) / DAY) : null;
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    job_title: p.title,
    email: p.email,
    linkedin_url: p.linkedinUrl,
    country: p.country,
    persona: p.cls.persona,
    role_start_date: p.roleStartedAt?.slice(0, 10) ?? null,
    days_in_role: days,
    prior_tools: p.cls.priorTools.map((t) => CRM_LABEL[t] ?? t).join(", ") || null,
  };
}

function cell(v: string | number | null, sep: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with one row per contact (company columns repeated), UTF-8 BOM so Excel opens umlauts correctly. */
export function toCsv(companies: Company[], sep: "," | ";" = ",", now = new Date()): string {
  const header = [...COMPANY_COLUMNS.map((c) => `company_${c}`), ...CONTACT_COLUMNS.map((c) => `contact_${c}`)];
  const lines = [header.join(sep)];
  for (const c of companies) {
    const co = companyRecord(c);
    const people = c.people.length ? c.people : [null];
    for (const p of people) {
      const ct = p ? contactRecord(p, now) : null;
      lines.push([...COMPANY_COLUMNS.map((k) => cell(co[k], sep)), ...CONTACT_COLUMNS.map((k) => cell(ct ? ct[k] : null, sep))].join(sep));
    }
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function toJson(companies: Company[], now = new Date()) {
  return companies.map((c) => ({ company: companyRecord(c), contacts: c.people.map((p) => contactRecord(p, now)) }));
}
