import "server-only";
import { z } from "zod";
import { structured } from "@/lib/ai";
import { classifyJobByRules, classifyPersonByRules, divisionKey, matchExclusion, type JobInput, type PersonInput } from "@/lib/pipeline/rules";
import { JobFlag, JobFunction, RoleFamily, Seniority, type JobClassification, type PersonClassification, type Settings } from "@/lib/types";

const RULES = `A division is function + business unit + region (for example "Sales · Wholesale · DACH"). Roles in different divisions never add up.
Shop-floor, store and call-center staff are excluded (is_excluded = true): sales associates in stores, cashiers, promoters, call-center agents, temps.
"Key Account Manager Retail" and "Account Executive Retail Partnerships" sell TO retailers: they are NOT excluded.
Recruiter or agency postings that do not name the hiring employer have employer_identified = false.
crm_mentions uses lowercase names: salesforce, hubspot, pipedrive, dynamics, zoho, spreadsheet (Excel, Google Sheets).
flags: first_sdr (first SDR / first sales hire), founding_team (founding AE/SDR), build_from_scratch ("from scratch", "von Grund auf", "aufbauen").
region: DACH for Germany, Austria, Switzerland; otherwise UK&I, Benelux, Nordics, France, Southern Europe, CEE, North America, or the country code.
business_unit: a short name such as Wholesale, Enterprise, Mid-Market, SMB, E-Commerce, Retail Partnerships, Partnerships, Retail Stores; "General" when none is named.`;

const JobOut = z.object({
  index: z.number().int(),
  function: JobFunction,
  business_unit: z.string(),
  region: z.string(),
  role_family: RoleFamily,
  seniority: Seniority,
  crm_mentions: z.array(z.string()),
  flags: z.array(JobFlag.exclude(["new_region", "reposted"])),
  is_excluded: z.boolean(),
  exclusion_reason: z.string().nullable(),
  employer_identified: z.boolean(),
});
const JobBatch = z.object({ postings: z.array(JobOut) });

const PersonOut = z.object({
  role_family: RoleFamily,
  seniority: Seniority,
  persona: z.enum(["Economic buyer", "RevOps / operator", "Hiring manager", "Practitioner", "Influencer"]),
  is_decision_maker: z.boolean(),
  prior_tools: z.array(z.string()),
  function: JobFunction,
  business_unit: z.string().nullable(),
  region: z.string().nullable(),
});

const KNOWN_CRMS = new Set(["salesforce", "hubspot", "pipedrive", "dynamics", "zoho", "spreadsheet"]);

/** Rules first; when ANTHROPIC_API_KEY is set, Claude classifies batches of ≤ 20 postings. Refusals keep the rules result. */
export async function classifyJobs(jobs: JobInput[], settings: Settings): Promise<{ results: JobClassification[]; by: "rules" | "claude" | "mixed" }> {
  const results = jobs.map((j) => classifyJobByRules(j, settings.exclusions));
  let claudeBatches = 0;
  let total = 0;
  for (let start = 0; start < jobs.length; start += 20) {
    const batch = jobs.slice(start, start + 20);
    total++;
    const user = batch
      .map((j, i) => `<posting index="${i}">\nTitle: ${j.title}\nEmployer: ${j.employerName ?? "unknown"}\nLocation: ${j.location ?? "unknown"}\nText: ${(j.description ?? "").slice(0, 1500)}\n</posting>`)
      .join("\n");
    const res = await structured({
      schema: JobBatch,
      effort: "low",
      system: `You classify job postings for a sales-intelligence tool. Return one entry per posting, with its index.\n${RULES}`,
      user,
    });
    if (!res.ok) continue;
    claudeBatches++;
    for (const p of res.data.postings) {
      const i = start + p.index;
      if (p.index < 0 || p.index >= batch.length) continue;
      // Workspace exclusion regexes always win, so the live tester in Settings stays truthful.
      const regex = matchExclusion(jobs[i].title, settings.exclusions);
      results[i] = {
        function: p.function,
        businessUnit: p.business_unit.trim() || "General",
        region: p.region.trim() || results[i].region,
        roleFamily: p.role_family,
        seniority: p.seniority,
        crmMentions: [...new Set(p.crm_mentions.map((c) => c.toLowerCase()).filter((c) => KNOWN_CRMS.has(c)))],
        flags: p.flags,
        isExcluded: regex !== null || p.is_excluded,
        exclusionReason: regex ? `Matches exclusion “${regex}”` : p.is_excluded ? (p.exclusion_reason ?? "Excluded by classifier") : null,
        employerIdentified: p.employer_identified,
        by: "claude",
      };
    }
  }
  return { results, by: claudeBatches === 0 ? "rules" : claudeBatches === total ? "claude" : "mixed" };
}

export async function classifyPerson(person: PersonInput): Promise<PersonClassification> {
  const rules = classifyPersonByRules(person);
  const res = await structured({
    schema: PersonOut,
    effort: "low",
    maxTokens: 2000,
    system: `You classify a LinkedIn profile for a sales-intelligence tool. prior_tools lists CRMs used at earlier jobs (lowercase: salesforce, hubspot, pipedrive, dynamics, zoho). is_decision_maker is true for sales leaders who own budget (Head of Sales, VP Sales, CRO, Head of RevOps, sales director, founder selling). ${RULES}`,
    user: `Title: ${person.title}\nLocation: ${person.location ?? "unknown"}\nSkills: ${(person.skills ?? []).join(", ")}\nAbout: ${(person.about ?? "").slice(0, 1000)}\nPrevious roles:\n${(person.previousRoles ?? [])
      .slice(0, 6)
      .map((r) => `- ${r.title} at ${r.company}: ${(r.description ?? "").slice(0, 300)}`)
      .join("\n")}`,
  });
  if (!res.ok) return rules;
  const p = res.data;
  return {
    roleFamily: p.role_family,
    seniority: p.seniority,
    persona: p.persona,
    isDecisionMaker: p.is_decision_maker,
    priorTools: [...new Set(p.prior_tools.map((t) => t.toLowerCase()).filter((t) => KNOWN_CRMS.has(t) && t !== "spreadsheet"))],
    divisionKey: p.business_unit && p.region && (p.function === "sales" || p.function === "revops") ? divisionKey(p.function, p.business_unit, p.region) : rules.divisionKey,
    by: "claude",
  };
}
