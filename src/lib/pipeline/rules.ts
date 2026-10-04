import type { JobClassification, JobFlag, JobFunction, PersonClassification, RoleFamily, Seniority } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Exclusions                                                          */
/* ------------------------------------------------------------------ */

/** Compiles the workspace's exclusion patterns; invalid patterns are skipped (the tester shows them). */
export function compileExclusions(patterns: string[]): { source: string; re: RegExp }[] {
  const out: { source: string; re: RegExp }[] = [];
  for (const p of patterns) {
    const re = safeRegex(p);
    if (re) out.push({ source: p, re });
  }
  return out;
}

export function safeRegex(pattern: string): RegExp | null {
  if (!pattern.trim()) return null;
  try {
    return new RegExp(pattern, "iu");
  } catch {
    return null;
  }
}

/** Returns the first exclusion pattern that matches the title, or null. */
export function matchExclusion(title: string, patterns: string[]): string | null {
  for (const { source, re } of compileExclusions(patterns)) {
    if (re.test(title)) return source;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Role family, function, seniority                                     */
/* ------------------------------------------------------------------ */

const LEADER =
  /\b(head of (sales|revenue|business development|growth|revops|revenue operations|sales operations|partnerships|wholesale)|(vp|svp|evp)( of)? (sales|revenue|business development)|vice president[^,]*\b(sales|revenue)|chief (revenue|sales|commercial) officer|\bcro\b|\bcco\b|sales director|director,? (of )?(sales|revenue|business development)|vertriebsleit|leit(er|erin|ung) (des )?vertrieb|bereichsleit\w* vertrieb|country manager|general manager|sales team ?lead|team ?lead(er)? (sales|sdr|bdr|vertrieb)|head of sdr|sdr (team )?lead|bdr (team )?lead|sales lead\b)/iu;
const SDR =
  /\b(sdr|bdr|sales development|business development (rep|representative|manager)|lead development|inside sales|account development|market development rep)/iu;
const REVOPS =
  /(rev ?ops|revenue operations|sales operations|sales ops|crm[- ](admin|administrator|manager|specialist)|(salesforce|hubspot) (admin|administrator)|sales enablement|enablement manager|go[- ]to[- ]market operations|gtm ops)/iu;
const AM = /(key account|account manager|partner manager|channel manager|\bkam\b|kundenbetreuer|customer account manager)/iu;
const AE =
  /\b(account executive|\bae\b|sales executive|sales manager|new business|closer|vertriebsmitarbeiter|vertriebsmanager|außendienst|aussendienst|sales representative|sales rep\b|business development executive)/iu;
const CS = /(customer success|customer support|kundenservice|onboarding manager|implementation manager)/iu;
const MARKETING = /(marketing|demand gen|growth marketer|content manager|brand manager)/iu;
const SALES_WORD = /(sales|vertrieb|verkauf|revenue|business development)/iu;

export function roleFamily(title: string): RoleFamily {
  if (LEADER.test(title)) return "leader";
  if (REVOPS.test(title)) return "revops";
  if (SDR.test(title)) return "sdr";
  if (AM.test(title)) return "am";
  if (AE.test(title)) return "ae";
  if (CS.test(title)) return "cs";
  if (MARKETING.test(title)) return "marketing";
  return "other";
}

export function jobFunction(title: string, family: RoleFamily = roleFamily(title)): JobFunction {
  if (REVOPS.test(title)) return "revops";
  switch (family) {
    case "sdr":
    case "ae":
    case "am":
    case "leader":
      return "sales";
    case "revops":
      return "revops";
    case "cs":
      return "customer_success";
    case "marketing":
      return "marketing";
    default:
      return SALES_WORD.test(title) ? "sales" : "other";
  }
}

export function seniority(title: string): Seniority {
  if (/\b(chief|cro|cco|ceo|coo|c-level|geschäftsführ)/iu.test(title)) return "c_level";
  if (/\b(vp|svp|evp|vice president)\b/iu.test(title)) return "vp";
  if (/\b(head of|director|leiter|leiterin|leitung|country manager|general manager)/iu.test(title)) return "head";
  if (/\b(team ?lead|lead\b|principal|manager,? sales team)/iu.test(title)) return "lead";
  if (/\b(senior|sr\.?)\b/iu.test(title)) return "senior";
  if (/\b(junior|jr\.?|intern|praktik|werkstudent|trainee|working student|entry)/iu.test(title)) return "entry";
  return "mid";
}

/* ------------------------------------------------------------------ */
/* Business unit and region                                             */
/* ------------------------------------------------------------------ */

const BUSINESS_UNITS: [RegExp, string][] = [
  [/(retail stores?|\bstores?\b|filiale|shop ?(assistant|mitarbeiter))/iu, "Retail Stores"],
  [/(retail partner\w*|key account[^,]*retail|retail key account|\bretail\b)/iu, "Retail Partnerships"],
  [/(wholesale|großhandel|grosshandel)/iu, "Wholesale"],
  [/(enterprise|großkunden|strategic accounts)/iu, "Enterprise"],
  [/(mid[- ]?market|mittelstand)/iu, "Mid-Market"],
  [/(\bsmb\b|small business|\bkmu\b|startups?\b)/iu, "SMB"],
  [/(e-?commerce|\bd2c\b|\bdtc\b|direct[- ]to[- ]consumer|online shop)/iu, "E-Commerce"],
  [/(marketplace)/iu, "Marketplaces"],
  [/(public sector|öffentliche)/iu, "Public Sector"],
  [/(partnerships?|channel|alliances?|reseller)/iu, "Partnerships"],
];

export function businessUnit(title: string): string | null {
  for (const [re, label] of BUSINESS_UNITS) if (re.test(title)) return label;
  return null;
}

const COUNTRY_NAMES: [RegExp, string][] = [
  [/\b(germany|deutschland|berlin|münchen|munich|hamburg|köln|cologne|frankfurt|stuttgart|düsseldorf|dusseldorf|leipzig|dresden|hannover|nürnberg|nuremberg|bremen|essen|dortmund|karlsruhe|mannheim|herzogenaurach|bonn|münster|freiburg)\b/iu, "DE"],
  [/\b(austria|österreich|wien|vienna|graz|linz|salzburg|innsbruck)\b/iu, "AT"],
  [/\b(switzerland|schweiz|suisse|zürich|zurich|basel|bern|geneva|genf|lausanne|zug|luzern|lucerne)\b/iu, "CH"],
  [/\b(united kingdom|\buk\b|england|london|manchester|edinburgh|bristol|scotland)\b/iu, "GB"],
  [/\b(ireland|dublin)\b/iu, "IE"],
  [/\b(netherlands|niederlande|amsterdam|rotterdam|utrecht|the hague)\b/iu, "NL"],
  [/\b(belgium|belgien|brussels|brüssel|antwerp)\b/iu, "BE"],
  [/\b(france|frankreich|paris|lyon)\b/iu, "FR"],
  [/\b(spain|spanien|madrid|barcelona)\b/iu, "ES"],
  [/\b(italy|italien|milan|mailand|rome|rom)\b/iu, "IT"],
  [/\b(sweden|schweden|stockholm)\b/iu, "SE"],
  [/\b(denmark|dänemark|copenhagen)\b/iu, "DK"],
  [/\b(norway|norwegen|oslo)\b/iu, "NO"],
  [/\b(finland|helsinki)\b/iu, "FI"],
  [/\b(poland|polen|warsaw|warschau|krakow)\b/iu, "PL"],
  [/\b(czech|prague|prag)\b/iu, "CZ"],
  [/\b(portugal|lisbon|lissabon)\b/iu, "PT"],
  [/\b(united states|\busa\b|new york|san francisco|boston|austin|chicago)\b/iu, "US"],
  [/\b(canada|toronto)\b/iu, "CA"],
];

const REGION_OF: Record<string, string> = {
  DE: "DACH",
  AT: "DACH",
  CH: "DACH",
  GB: "UK&I",
  IE: "UK&I",
  NL: "Benelux",
  BE: "Benelux",
  LU: "Benelux",
  FR: "France",
  ES: "Southern Europe",
  IT: "Southern Europe",
  PT: "Southern Europe",
  SE: "Nordics",
  DK: "Nordics",
  NO: "Nordics",
  FI: "Nordics",
  PL: "CEE",
  CZ: "CEE",
  US: "North America",
  CA: "North America",
};

export function countryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const iso = location.match(/\b(DE|AT|CH|GB|UK|IE|NL|BE|FR|ES|IT|SE|DK|NO|FI|PL|CZ|PT|US|CA)\b/u);
  for (const [re, code] of COUNTRY_NAMES) if (re.test(location)) return code;
  if (iso) return iso[1] === "UK" ? "GB" : iso[1];
  return null;
}

export function cityFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const first = location.split(/[,·|/(]/u)[0]?.trim();
  if (!first || /remote|hybrid|germany|deutschland|austria|switzerland|dach|europe/iu.test(first)) return null;
  return first;
}

export function regionFor(country: string | null, text = ""): string {
  if (/\bdach\b/iu.test(text)) return "DACH";
  if (/\bnordics?\b/iu.test(text)) return "Nordics";
  if (/\bbenelux\b/iu.test(text)) return "Benelux";
  if (/\b(uk&i|uki)\b/iu.test(text)) return "UK&I";
  if (/\b(emea|europe)\b/iu.test(text) && !country) return "EMEA";
  if (country && REGION_OF[country]) return REGION_OF[country];
  return country ?? "Unknown region";
}

/* ------------------------------------------------------------------ */
/* CRM names, flags, recruiters                                         */
/* ------------------------------------------------------------------ */

const CRMS: [RegExp, string][] = [
  [/salesforce|sfdc\b/iu, "salesforce"],
  [/hubspot/iu, "hubspot"],
  [/pipedrive/iu, "pipedrive"],
  [/(microsoft )?dynamics( 365| crm)?\b/iu, "dynamics"],
  [/\bzoho\b/iu, "zoho"],
  [/\b(excel|spreadsheets?|google sheets|tabellen)\b/iu, "spreadsheet"],
];

export function crmMentions(text: string): string[] {
  const found: string[] = [];
  for (const [re, name] of CRMS) if (re.test(text)) found.push(name);
  return found;
}

export const CRM_LABEL: Record<string, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  dynamics: "Microsoft Dynamics",
  zoho: "Zoho",
  spreadsheet: "spreadsheets",
};

export function isCompetitorCrm(name: string, ownProduct: string): boolean {
  return name !== ownProduct && name !== "spreadsheet";
}

export function jobFlags(text: string): JobFlag[] {
  const flags: JobFlag[] = [];
  if (/(first|1st|erste[rnms]?) (sdr|bdr|sales|vertriebs|account executive|ae\b|hire)/iu.test(text)) flags.push("first_sdr");
  if (/founding (ae|account executive|sdr|bdr|sales|team|member|gtm)|gründungsteam/iu.test(text)) flags.push("founding_team");
  if (
    /(from scratch|build (out )?(the|our|a|an) (new )?(sales|sdr|bdr|gtm)? ?(team|function|motion)|von grund auf|(team|vertrieb)\w* aufbauen|aufbau (des|eines|unseres|der)|greenfield|zero to one|0 to 1|0→1)/iu.test(
      text,
    )
  )
    flags.push("build_from_scratch");
  return flags;
}

const RECRUITER_NAME =
  /(recruit|personal(beratung|dienstleist|vermittlung|service)|staffing|headhunt|talent (partners|solutions)|executive search|\bhays\b|randstad|adecco|michael page|robert half|manpower|kelly services|page personnel)/iu;
const FOR_CLIENT = /(for (our|a) client|on behalf of (our|a) client|für unseren? (kunden|mandanten)|im auftrag (unseres|eines) (kunden|mandanten)|unser kunde,? ein)/iu;

export function employerIdentified(employerName: string | null, text: string): boolean {
  if (employerName && RECRUITER_NAME.test(employerName)) return false;
  if (FOR_CLIENT.test(text)) return false;
  if (!employerName || !employerName.trim() || /confidential|vertraulich|anonym/iu.test(employerName)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Classifiers                                                         */
/* ------------------------------------------------------------------ */

export function divisionFunction(fn: JobFunction): JobFunction {
  return fn === "revops" ? "sales" : fn;
}

export const FUNCTION_LABEL: Record<JobFunction, string> = {
  sales: "Sales",
  revops: "RevOps",
  marketing: "Marketing",
  customer_success: "Customer Success",
  other: "Other",
};

export function divisionKey(fn: JobFunction, unit: string, region: string): string {
  return `${divisionFunction(fn)}|${unit}|${region}`.toLowerCase();
}

export function divisionLabel(fn: JobFunction, unit: string, region: string): string {
  return `${FUNCTION_LABEL[divisionFunction(fn)]} · ${unit} · ${region}`;
}

export interface JobInput {
  title: string;
  description?: string | null;
  location?: string | null;
  country?: string | null;
  employerName?: string | null;
}

export function classifyJobByRules(job: JobInput, exclusions: string[]): JobClassification {
  const title = job.title ?? "";
  const text = `${title}\n${job.description ?? ""}`;
  const family = roleFamily(title);
  const fn = jobFunction(title, family);
  const country = job.country ?? countryFromLocation(job.location);
  const exclusion = matchExclusion(title, exclusions);
  return {
    function: fn,
    businessUnit: businessUnit(title) ?? businessUnit(job.description?.slice(0, 400) ?? "") ?? "General",
    region: regionFor(country, `${title} ${job.location ?? ""}`),
    roleFamily: family,
    seniority: seniority(title),
    crmMentions: crmMentions(text),
    flags: jobFlags(text),
    isExcluded: exclusion !== null,
    exclusionReason: exclusion ? `Matches exclusion “${exclusion}” (shop-floor, store or call-center staff)` : null,
    employerIdentified: employerIdentified(job.employerName ?? null, text),
    by: "rules",
  };
}

export interface PersonInput {
  title: string;
  location?: string | null;
  skills?: string[];
  previousRoles?: { company: string; title: string; description?: string | null }[];
  about?: string | null;
}

export function personaFor(family: RoleFamily, level: Seniority): string {
  if (family === "leader" || level === "vp" || level === "c_level") return "Economic buyer";
  if (family === "revops") return "RevOps / operator";
  if (level === "head" || level === "lead") return "Hiring manager";
  if (family === "sdr" || family === "ae" || family === "am") return "Practitioner";
  return "Influencer";
}

export function classifyPersonByRules(person: PersonInput): PersonClassification {
  const family = roleFamily(person.title);
  const level = seniority(person.title);
  const fn = jobFunction(person.title, family);
  const toolsText = [
    ...(person.skills ?? []),
    ...(person.previousRoles ?? []).map((r) => `${r.company} ${r.title} ${r.description ?? ""}`),
    person.about ?? "",
  ].join("\n");
  const priorTools = crmMentions(toolsText).filter((t) => t !== "spreadsheet");
  const unit = businessUnit(person.title);
  const country = countryFromLocation(person.location);
  const isSalesSide = fn === "sales" || fn === "revops";
  return {
    roleFamily: family,
    seniority: level,
    persona: personaFor(family, level),
    isDecisionMaker: isSalesSide && (family === "leader" || ["head", "vp", "c_level"].includes(level)),
    priorTools,
    divisionKey: isSalesSide && unit ? divisionKey(fn, unit, regionFor(country, person.title)) : null,
    by: "rules",
  };
}
