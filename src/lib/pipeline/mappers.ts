/**
 * Maps raw Apify actor output to Signalz shapes. Actors name fields differently, so every
 * actor difference lives in this file: `pick` tries several paths and returns the first non-empty value.
 */
import { companyKey, normalizeDomain, normalizeLinkedInUrl } from "@/lib/linkedin";
import { cityFromLocation, countryFromLocation } from "@/lib/pipeline/rules";

type Raw = Record<string, unknown>;

const DAY = 86_400_000;

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) cur = /^\d+$/.test(part) ? cur[Number(part)] : undefined;
    else if (typeof cur === "object") cur = (cur as Raw)[part];
    else return undefined;
  }
  return cur;
}

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** First non-empty value among the paths (dotted, with numeric array indexes). */
export function pick<T = unknown>(obj: unknown, ...paths: string[]): T | undefined {
  for (const p of paths) {
    const v = get(obj, p);
    if (!empty(v)) return v as T;
  }
  return undefined;
}

export function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januar: 1, jän: 1, jänner: 1,
  feb: 2, february: 2, februar: 2,
  mar: 3, march: 3, mär: 3, märz: 3, maerz: 3,
  apr: 4, april: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, dez: 12, dezember: 12,
};

const UNIT_MS: Record<string, number> = { second: 1000, minute: 60_000, hour: 3_600_000, day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY };
const DE_UNIT: Record<string, string> = { sekunde: "second", minute: "minute", stunde: "hour", tag: "day", woche: "week", monat: "month", jahr: "year" };

const iso = (y: number, m = 1, d = 1) => new Date(Date.UTC(y, m - 1, d)).toISOString();

/** Normalises "3 days ago", "vor 2 Tagen", {year, month}, epoch seconds/ms, "Mar 2024", ISO… to an ISO string. */
export function normDate(v: unknown, now = new Date()): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (v > 1e12) return new Date(v).toISOString();
    if (v > 1e9) return new Date(v * 1000).toISOString();
    if (v >= 1900 && v <= 2100) return iso(v);
    return null;
  }
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Raw;
    const y = Number(o.year ?? o.y);
    if (y) return iso(y, Number(o.month ?? o.m ?? 1) || 1, Number(o.day ?? o.d ?? 1) || 1);
    const inner = pick(o, "date", "text", "start", "startDate", "value", "timestamp");
    return inner !== undefined ? normDate(inner, now) : null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (/^(just now|now|gerade( eben)?|today|heute)$/.test(s)) return now.toISOString();
  if (/^(yesterday|gestern)$/.test(s)) return new Date(now.getTime() - DAY).toISOString();
  if (/^\d{10,13}$/.test(s)) return normDate(Number(s), now);

  const en = s.match(/(\d+|an?|one)\+?\s*(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (en) {
    const n = /^\d+$/.test(en[1]) ? Number(en[1]) : 1;
    return new Date(now.getTime() - n * UNIT_MS[en[2]]).toISOString();
  }
  const de = s.match(/vor\s+(\d+|einem|einer|ein)\s+(sekunde|minute|stunde|tag|woche|monat|jahr)/);
  if (de) {
    const n = /^\d+$/.test(de[1]) ? Number(de[1]) : 1;
    return new Date(now.getTime() - n * UNIT_MS[DE_UNIT[de[2]]]).toISOString();
  }
  const short = s.match(/^(\d+)\s*([mhdwy]|mo)$/);
  if (short) {
    const unit = { m: "minute", h: "hour", d: "day", w: "week", mo: "month", y: "year" }[short[2]]!;
    return new Date(now.getTime() - Number(short[1]) * UNIT_MS[unit]).toISOString();
  }
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3] ?? 1));
  m = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return iso(Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^([a-zäö]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return iso(Number(m[2]), MONTHS[m[1]]);
  m = s.match(/^(\d{4})$/);
  if (m) return iso(Number(m[1]));
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** "201-500" → 201, "1,200" → 1200, "1.200" → 1200, "10,001+" → 10001, "1.2K" → 1200. */
export function normCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "object" && v && !Array.isArray(v)) {
    const o = v as Raw;
    return normCount(pick(o, "start", "min", "from", "value", "count"));
  }
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  const k = s.match(/^(\d+(?:[.,]\d+)?)\s*k\b/);
  if (k) return Math.round(Number(k[1].replace(",", ".")) * 1000);
  const first = s.match(/\d[\d.,]*/);
  if (!first) return null;
  const digits = first[0].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(/[.,].*$/, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** "18%" / 18 / 0.18 → 0.18 */
export function normGrowth(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;
  return Math.abs(n) > 1 ? n / 100 : n;
}

/* ------------------------------------------------------------------ */
/* Person                                                              */
/* ------------------------------------------------------------------ */

export interface PersonDraft {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string | null;
  email: string | null;
  location: string | null;
  country: string | null;
  roleStartedAt: string | null;
  previousRoles: { company: string; title: string; from: string | null; to: string | null; description: string | null }[];
  skills: string[];
  schools: string[];
  posts: { text: string; at: string | null; url: string | null }[];
  about: string | null;
  currentCompanyUrl: string | null;
  currentCompanyName: string | null;
}

function experienceList(raw: Raw): Raw[] {
  const list = pick<unknown[]>(raw, "experiences", "experience", "positions", "position", "workExperience", "jobs");
  return Array.isArray(list) ? (list.filter((x) => x && typeof x === "object") as Raw[]) : [];
}

function expDates(e: Raw, now: Date): { from: string | null; to: string | null; current: boolean } {
  let from = normDate(pick(e, "startDate", "starts_at", "start", "timePeriod.startDate", "dateRange.start", "date.start", "from"), now);
  let to = normDate(pick(e, "endDate", "ends_at", "end", "timePeriod.endDate", "dateRange.end", "date.end", "to"), now);
  let current = Boolean(pick(e, "isCurrent", "current")) || false;
  const caption = str(pick(e, "caption", "duration", "dates", "dateRange.text", "period"));
  if (caption && !from) {
    const [a, b] = caption.split(/\s+[-–]\s+/);
    from = normDate(a?.split("·")[0]?.trim(), now);
    const end = b?.split("·")[0]?.trim();
    if (end && /present|heute|today|now/i.test(end)) current = true;
    else to = normDate(end, now);
  }
  if (!to && from) current = current || !pick(e, "endDate", "ends_at", "end");
  return { from, to, current };
}

export function mapPerson(raw: Raw, now = new Date()): PersonDraft {
  const first = str(pick(raw, "firstName", "first_name", "firstname")) ?? "";
  const last = str(pick(raw, "lastName", "last_name", "lastname")) ?? "";
  const name = str(pick(raw, "fullName", "full_name", "name")) ?? `${first} ${last}`.trim();
  const [f, ...rest] = name.split(/\s+/);
  const exps = experienceList(raw);
  const mapped = exps.map((e) => {
    const d = expDates(e, now);
    return {
      company: str(pick(e, "companyName", "company.name", "company", "subtitle", "organization")) ?? "",
      title: str(pick(e, "title", "position", "jobTitle", "role")) ?? "",
      companyUrl: str(pick(e, "companyLinkedinUrl", "companyUrl", "company.url", "company.linkedinUrl", "company_linkedin_url", "companyLink", "companyProfileUrl")),
      description: str(pick(e, "description", "summary", "subComponents.0.description.0.text")),
      ...d,
    };
  });
  const currentIdx = mapped.findIndex((e) => e.current);
  const current = currentIdx >= 0 ? mapped[currentIdx] : mapped[0];
  const title = str(pick(raw, "jobTitle", "currentPosition.title", "occupation", "headline", "position", "title")) ?? current?.title ?? "";
  const location = str(pick(raw, "addressWithCountry", "location.default", "location.linkedinText", "location", "geoLocationName", "locationName", "addressLocality"));
  const skillsRaw = pick<unknown[]>(raw, "skills", "topSkills", "skillsList") ?? [];
  const skills = (Array.isArray(skillsRaw) ? skillsRaw : String(skillsRaw).split(/[,·•]/)).map((s) => (typeof s === "string" ? s : (str(pick(s, "name", "title")) ?? ""))).filter(Boolean);
  const eduRaw = pick<unknown[]>(raw, "educations", "education", "schools") ?? [];
  const schools = (Array.isArray(eduRaw) ? eduRaw : []).map((s) => (typeof s === "string" ? s : (str(pick(s, "schoolName", "title", "school.name", "school", "name")) ?? ""))).filter(Boolean);
  const postsRaw = pick<unknown[]>(raw, "posts", "activity", "recentPosts", "updates") ?? [];
  const posts = (Array.isArray(postsRaw) ? postsRaw : [])
    .map((p) => ({ text: str(pick(p, "text", "content", "postText", "commentary", "title")) ?? "", at: normDate(pick(p, "postedAt", "date", "postedDate", "time", "timestamp", "created_at"), now), url: str(pick(p, "url", "postUrl", "link")) }))
    .filter((p) => p.text);
  const companyUrl = str(pick(raw, "companyLinkedinUrl", "currentCompany.linkedinUrl", "currentCompany.url", "companyUrl", "company_linkedin_url")) ?? current?.companyUrl ?? null;
  const normalizedCompany = companyUrl ? normalizeLinkedInUrl(companyUrl) : null;
  return {
    name,
    firstName: first || f || "",
    lastName: last || rest.join(" "),
    title,
    linkedinUrl: normalizeLinkedInUrl(str(pick(raw, "linkedinUrl", "linkedInUrl", "profileUrl", "url", "publicProfileUrl", "linkedin_url")) ?? "")?.url ?? null,
    email: str(pick(raw, "email", "emailAddress", "workEmail")),
    location,
    country: countryFromLocation(location) ?? str(pick(raw, "countryCode", "country_code"))?.toUpperCase() ?? null,
    roleStartedAt: current?.from ?? null,
    previousRoles: mapped
      .filter((e, i) => i !== (currentIdx >= 0 ? currentIdx : 0))
      .map((e) => ({ company: e.company, title: e.title, from: e.from, to: e.to, description: e.description })),
    skills,
    schools,
    posts,
    about: str(pick(raw, "about", "summary")),
    currentCompanyUrl: normalizedCompany?.kind === "company" ? normalizedCompany.url : null,
    currentCompanyName: str(pick(raw, "companyName", "currentCompany.name", "company")) ?? current?.company ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Company                                                             */
/* ------------------------------------------------------------------ */

export interface CompanyDraft {
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  linkedinId: string | null;
  logoUrl: string | null;
  industry: string | null;
  headcount: number | null;
  headcountGrowth6m: number | null;
  country: string | null;
  city: string | null;
  description: string | null;
  fundingAt: string | null;
}

export function mapCompany(raw: Raw, now = new Date()): CompanyDraft {
  const url = str(pick(raw, "linkedinUrl", "linkedInUrl", "url", "companyUrl", "companyLinkedinUrl", "linkedin_url", "profileUrl"));
  const normalized = url ? normalizeLinkedInUrl(url) : null;
  const hqCity = str(pick(raw, "headquarter.city", "headquarters.city", "hq.city", "locations.0.city", "location.city", "city"));
  const hqCountry = str(pick(raw, "headquarter.country", "headquarters.country", "hq.country", "locations.0.country", "countryCode", "country"));
  const hqText = str(pick(raw, "headquarters", "headquarter", "hq", "location", "headquarter.description"));
  const country = hqCountry && /^[a-z]{2}$/i.test(hqCountry) ? hqCountry.toUpperCase() : countryFromLocation([hqCountry, hqText, hqCity].filter(Boolean).join(", "));
  const industries = pick<unknown>(raw, "industry", "industries", "industryName", "industryV2");
  return {
    name: str(pick(raw, "name", "companyName", "title", "company")) ?? "Unknown company",
    domain: normalizeDomain(str(pick(raw, "website", "websiteUrl", "companyWebsite", "domain", "url_website"))),
    linkedinUrl: normalized?.kind === "company" ? normalized.url : null,
    linkedinId: str(pick(raw, "companyId", "linkedinId", "id", "entityUrn", "company_id"))?.replace(/\D/g, "") || null,
    logoUrl: str(pick(raw, "logo", "logoUrl", "logo_url", "profilePicture", "logoResolutionResult")),
    industry: Array.isArray(industries) ? (str(industries[0]) ?? str(pick(industries[0], "name"))) : str(industries),
    headcount: normCount(pick(raw, "employeeCount", "staffCount", "employeesOnLinkedIn", "employees", "companySize", "employeeCountRange", "employee_count_range", "size")),
    headcountGrowth6m: normGrowth(pick(raw, "headcountGrowth6m", "employeeGrowth6m", "growth.sixMonths", "headcountGrowth.6m", "employeeGrowth.sixMonth", "growth6m")),
    country,
    city: hqCity ?? cityFromLocation(hqText),
    description: str(pick(raw, "description", "about", "tagline"))?.slice(0, 1000) ?? null,
    fundingAt: normDate(pick(raw, "fundingData.lastFundingRound.announcedOn", "lastFundingDate", "funding.lastRoundDate", "lastFundingRound.date"), now),
  };
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export interface JobDraft {
  externalId: string;
  title: string;
  url: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  employerName: string | null;
  employerLinkedinUrl: string | null;
  employerDomain: string | null;
  postedAt: string | null;
  reposted: boolean;
}

export function mapJob(raw: Raw, now = new Date()): JobDraft | null {
  const title = str(pick(raw, "title", "jobTitle", "positionName", "position", "name"));
  if (!title) return null;
  const url = str(pick(raw, "url", "jobUrl", "link", "jobLink", "applyUrl"));
  const id = str(pick(raw, "id", "jobId", "job_id", "jobPostingId", "trackingId")) ?? url?.match(/view\/(?:[^/]*-)?(\d+)/)?.[1] ?? `${title}|${str(pick(raw, "companyName", "company")) ?? ""}|${str(pick(raw, "location")) ?? ""}`;
  const location = str(pick(raw, "location", "jobLocation", "place", "formattedLocation", "location.name"));
  const employerUrl = str(pick(raw, "companyUrl", "companyLinkedinUrl", "company.url", "company.linkedinUrl", "companyLink"));
  const n = employerUrl ? normalizeLinkedInUrl(employerUrl) : null;
  return {
    externalId: id,
    title,
    url,
    location,
    country: countryFromLocation(location),
    city: cityFromLocation(location),
    description: str(pick(raw, "description", "descriptionText", "jobDescription", "description_text", "descriptionHtml"))?.replace(/<[^>]+>/g, " ").slice(0, 4000) ?? null,
    employerName: str(pick(raw, "companyName", "company.name", "company", "companyTitle", "employer", "hiringOrganization.name")),
    employerLinkedinUrl: n?.kind === "company" ? n.url : null,
    employerDomain: normalizeDomain(str(pick(raw, "companyWebsite", "company.website", "companyDomain"))),
    postedAt: normDate(pick(raw, "postedAt", "publishedAt", "postedTime", "posted_at", "datePosted", "listedAt", "postedDate", "date", "postingDate"), now),
    reposted: Boolean(pick(raw, "reposted", "isReposted", "repostedJob")),
  };
}

export function employerKey(j: JobDraft): string | null {
  return companyKey({ linkedinUrl: j.employerLinkedinUrl, domain: j.employerDomain })[0] ?? (j.employerName ? `name:${j.employerName.toLowerCase().replace(/\s+(gmbh|ag|se|kg|ltd|inc|co)\.?$/i, "").trim()}` : null);
}
