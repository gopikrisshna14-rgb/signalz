import { companyRecord, contactRecord, COMPANY_COLUMNS, CONTACT_COLUMNS } from "@/lib/export";
import type { Company } from "@/lib/types";

const API = "https://api.hubapi.com";

/** Signalz column → HubSpot property. "company.x" / "contact.x"; empty value = not pushed. */
export const DEFAULT_MAPPING: Record<string, string> = {
  "company.name": "name",
  "company.domain": "domain",
  "company.linkedin_url": "linkedin_company_page",
  "company.industry": "",
  "company.number_of_employees": "numberofemployees",
  "company.country": "country",
  "company.city": "city",
  "company.signal_priority": "signal_priority",
  "company.signal_tier": "signal_tier",
  "company.signal_bucket": "signal_bucket",
  "company.hiring_cluster_index": "hiring_cluster_index",
  "company.icp_fit": "icp_fit",
  "company.hiring_division": "hiring_division",
  "company.open_sales_roles": "open_sales_roles",
  "company.new_leader_days_in_role": "new_leader_days_in_role",
  "company.signal_top_reason": "signal_top_reason",
  "company.signal_reasons": "signal_reasons",
  "company.signal_owner": "signal_owner",
  "contact.first_name": "firstname",
  "contact.last_name": "lastname",
  "contact.job_title": "jobtitle",
  "contact.email": "email",
  "contact.linkedin_url": "signalz_linkedin_url",
  "contact.country": "country",
  "contact.persona": "signalz_persona",
  "contact.role_start_date": "signalz_role_start_date",
  "contact.days_in_role": "signalz_days_in_role",
  "contact.prior_tools": "signalz_prior_tools",
};

/** Custom properties created by "Create Signalz properties". */
export const CUSTOM_PROPERTIES: { object: "companies" | "contacts"; name: string; label: string; type: "string" | "number" | "date"; fieldType: "text" | "textarea" | "number" | "date" }[] = [
  { object: "companies", name: "signal_priority", label: "Signal priority", type: "number", fieldType: "number" },
  { object: "companies", name: "signal_tier", label: "Signal tier", type: "string", fieldType: "text" },
  { object: "companies", name: "signal_bucket", label: "Signal bucket", type: "string", fieldType: "text" },
  { object: "companies", name: "hiring_cluster_index", label: "Hiring cluster index", type: "number", fieldType: "number" },
  { object: "companies", name: "icp_fit", label: "ICP fit", type: "number", fieldType: "number" },
  { object: "companies", name: "hiring_division", label: "Hiring division", type: "string", fieldType: "text" },
  { object: "companies", name: "open_sales_roles", label: "Open sales roles", type: "number", fieldType: "number" },
  { object: "companies", name: "new_leader_days_in_role", label: "New leader days in role", type: "number", fieldType: "number" },
  { object: "companies", name: "signal_top_reason", label: "Signal top reason", type: "string", fieldType: "text" },
  { object: "companies", name: "signal_reasons", label: "Signal reasons", type: "string", fieldType: "textarea" },
  { object: "companies", name: "signal_owner", label: "Signal owner", type: "string", fieldType: "text" },
  { object: "contacts", name: "signalz_linkedin_url", label: "LinkedIn URL (Signalz)", type: "string", fieldType: "text" },
  { object: "contacts", name: "signalz_persona", label: "Persona (Signalz)", type: "string", fieldType: "text" },
  { object: "contacts", name: "signalz_role_start_date", label: "Role start date (Signalz)", type: "date", fieldType: "date" },
  { object: "contacts", name: "signalz_days_in_role", label: "Days in role (Signalz)", type: "number", fieldType: "number" },
  { object: "contacts", name: "signalz_prior_tools", label: "Prior tools (Signalz)", type: "string", fieldType: "text" },
];

export interface PushPlan {
  companyId: string;
  company: { match: { hubspotId: string | null; domain: string | null }; properties: Record<string, string> };
  contacts: { personId: string; match: { hubspotId: string | null; email: string | null; linkedinUrl: string | null }; properties: Record<string, string> }[];
  note: { body: string };
}

function props(rec: Record<string, string | number | null>, prefix: "company" | "contact", mapping: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    const target = mapping[`${prefix}.${k}`] ?? DEFAULT_MAPPING[`${prefix}.${k}`];
    if (!target || v === null || v === "") continue;
    out[target] = String(v);
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The exact payload a push sends (shown as the dry run). */
export function buildPushPlan(c: Company, mapping: Record<string, string>): PushPlan {
  const jobs = c.jobs.filter((j) => c.clusters.some((cl) => cl.jobIds.includes(j.id)));
  const note = [
    `<p><strong>Signalz: why now</strong></p>`,
    `<ul>${(c.score?.reasons ?? []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`,
    jobs.length ? `<p><strong>Open roles</strong></p><ul>${jobs.map((j) => `<li>${j.url ? `<a href="${esc(j.url)}">${esc(j.title)}</a>` : esc(j.title)}</li>`).join("")}</ul>` : "",
  ].join("");
  return {
    companyId: c.id,
    company: { match: { hubspotId: c.crm.hubspotCompanyId, domain: c.domain }, properties: props(companyRecord(c), "company", mapping) },
    contacts: c.people.map((p) => ({
      personId: p.id,
      match: { hubspotId: c.crm.hubspotContactIds[p.id] ?? null, email: p.email, linkedinUrl: p.linkedinUrl },
      properties: props(contactRecord(p), "contact", mapping),
    })),
    note: { body: note },
  };
}

export const MAPPABLE = [...COMPANY_COLUMNS.map((c) => `company.${c}`), ...CONTACT_COLUMNS.map((c) => `contact.${c}`)];

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export class HubspotError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function hs<T = unknown>(token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HubspotError(res.status, (data as { message?: string }).message ?? `HubSpot ${res.status}`);
  return data as T;
}

export async function createProperties(token: string): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;
  for (const object of ["companies", "contacts"]) {
    try {
      await hs(token, `/crm/v3/properties/${object}/groups`, { method: "POST", body: { name: "signalz", label: "Signalz", displayOrder: -1 } });
    } catch (e) {
      if (!(e instanceof HubspotError && e.status === 409)) throw e;
    }
  }
  for (const p of CUSTOM_PROPERTIES) {
    try {
      await hs(token, `/crm/v3/properties/${p.object}`, { method: "POST", body: { name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: "signalz" } });
      created++;
    } catch (e) {
      if (e instanceof HubspotError && e.status === 409) existing++;
      else throw e;
    }
  }
  return { created, existing };
}

async function searchOne(token: string, object: "companies" | "contacts", property: string, value: string): Promise<string | null> {
  const r = await hs<{ results: { id: string }[] }>(token, `/crm/v3/objects/${object}/search`, {
    method: "POST",
    body: { filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }], limit: 1 },
  });
  return r.results[0]?.id ?? null;
}

async function upsert(token: string, object: "companies" | "contacts", id: string | null, properties: Record<string, string>): Promise<string> {
  if (id) {
    await hs(token, `/crm/v3/objects/${object}/${id}`, { method: "PATCH", body: { properties } });
    return id;
  }
  const r = await hs<{ id: string }>(token, `/crm/v3/objects/${object}`, { method: "POST", body: { properties } });
  return r.id;
}

/** Match company by domain, contacts by e-mail or LinkedIn URL; create or update; associate; add a note. */
export async function pushPlan(token: string, plan: PushPlan): Promise<{ companyHsId: string; contactIds: Record<string, string> }> {
  let companyHsId = plan.company.match.hubspotId;
  if (!companyHsId && plan.company.match.domain) companyHsId = await searchOne(token, "companies", "domain", plan.company.match.domain);
  companyHsId = await upsert(token, "companies", companyHsId, plan.company.properties);
  const contactIds: Record<string, string> = {};
  for (const c of plan.contacts) {
    let id = c.match.hubspotId;
    if (!id && c.match.email) id = await searchOne(token, "contacts", "email", c.match.email);
    if (!id && c.match.linkedinUrl) id = await searchOne(token, "contacts", "signalz_linkedin_url", c.match.linkedinUrl).catch(() => null);
    id = await upsert(token, "contacts", id, c.properties);
    await hs(token, `/crm/v4/objects/contact/${id}/associations/default/company/${companyHsId}`, { method: "PUT" });
    contactIds[c.personId] = id;
  }
  await hs(token, "/crm/v3/objects/notes", {
    method: "POST",
    body: {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: plan.note.body },
      associations: [{ to: { id: companyHsId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 }] }],
    },
  });
  return { companyHsId, contactIds };
}
