import { CRM_LABEL } from "@/lib/pipeline/rules";
import type { Angle, Company, Person, Template } from "@/lib/types";
import { ANGLE_LABEL } from "@/lib/types";

export const TEMPLATE_VARIABLES = ["first_name", "company", "division", "open_roles", "crm", "industry"] as const;

const t = (angle: Angle, name: string, connectionNote: string, message: string, emailSubject: string, emailBody: string): Template => ({
  id: `tpl_${angle}`,
  angle,
  name,
  connectionNote,
  message,
  emailSubject,
  emailBody,
  updatedAt: new Date(0).toISOString(),
});

const BUILTIN: Record<Angle, Template> = {
  first_90_days: t(
    "first_90_days",
    "First 90 days",
    "Hi {{first_name}}, congrats on the new role at {{company}}. I work with sales leaders who are setting up their team in the first months. Happy to connect.",
    "Hi {{first_name}}, thanks for connecting. I saw you are building {{division}} with {{open_roles}} open roles right now. In the first 90 days most leaders decide how the team will prospect, report and hand over deals. How are you planning to get the new reps productive quickly?",
    "Your first 90 days at {{company}}",
    "Hi {{first_name}},\n\ncongrats on the new role. With {{open_roles}} open roles in {{division}}, the next weeks will set how your team prospects and reports.\n\nHow are you planning to onboard the new reps?\n\nBest,",
  ),
  team_buildout: t(
    "team_buildout",
    "SDR team build-out",
    "Hi {{first_name}}, I noticed {{company}} is hiring {{open_roles}} people for {{division}}. I help teams in that phase, happy to connect.",
    "Hi {{first_name}}, thanks for connecting. {{open_roles}} open roles in {{division}} usually means a new playbook, new sequences and a lot of onboarding at once. What is the hardest part of ramping the new team for you right now?",
    "Ramping {{open_roles}} new hires at {{company}}",
    "Hi {{first_name}},\n\nI saw {{company}} is hiring {{open_roles}} people for {{division}}. Teams in that phase usually need a shared process before the new reps start.\n\nWhat does onboarding look like for the new hires?\n\nBest,",
  ),
  crm_displacement: t(
    "crm_displacement",
    "CRM displacement",
    "Hi {{first_name}}, I saw {{company}} is growing {{division}}. I work with sales teams in {{industry}}, happy to connect.",
    "Hi {{first_name}}, thanks for connecting. Your job ads mention {{crm}}. When a team grows by {{open_roles}} people, that is often the moment to check whether the CRM still fits the process. Is that on your list this quarter?",
    "{{crm}} and your growing team",
    "Hi {{first_name}},\n\nyour job ads mention {{crm}}. With {{open_roles}} new roles in {{division}}, it is a good moment to check whether the setup scales with the team.\n\nIs that something you are looking at this quarter?\n\nBest,",
  ),
  expansion: t(
    "expansion",
    "Expansion",
    "Hi {{first_name}}, I saw {{company}} is building a sales team in a new region. Happy to connect.",
    "Hi {{first_name}}, thanks for connecting. Opening {{division}} with {{open_roles}} roles is a big step. How are you keeping process and reporting consistent between the new team and headquarters?",
    "Opening a new region at {{company}}",
    "Hi {{first_name}},\n\ncongrats on opening {{division}}. A new region usually means a new team, new territories and new reporting.\n\nHow are you setting up the process for the new team?\n\nBest,",
  ),
};

/** The three templates every new workspace starts with. */
export function defaultTemplates(): Template[] {
  const now = new Date().toISOString();
  return [BUILTIN.first_90_days, BUILTIN.team_buildout, BUILTIN.crm_displacement].map((x) => ({ ...x, updatedAt: now }));
}

export function templateFor(templates: Template[], angle: Angle): Template {
  return templates.find((x) => x.angle === angle) ?? BUILTIN[angle];
}

/** "your new Wholesale team in DACH": the division, never "your company". */
export function divisionPhrase(company: Company): string {
  const top = company.clusters[0];
  if (!top) return "your sales team";
  return `your new ${top.businessUnit === "General" ? "sales" : top.businessUnit} team in ${top.region}`;
}

export function templateVars(company: Company, person: Person | null): Record<string, string> {
  const top = company.clusters[0];
  const crm = company.score?.crmNamed.find((c) => c !== "spreadsheet");
  return {
    first_name: person?.firstName || "there",
    company: company.name,
    division: divisionPhrase(company),
    open_roles: String(top?.openRoles ?? company.jobs.filter((j) => !j.closedAt && !j.cls.isExcluded).length),
    crm: crm ? (CRM_LABEL[crm] ?? crm) : "your current CRM",
    industry: company.industry ?? "your industry",
  };
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export const DATA_SOURCE_LINE = "PS: I found your public LinkedIn profile and your company's job ads; reply “stop” and I will not contact you again.";

export interface Opener {
  connectionNote: string;
  message: string;
  emailSubject: string;
  emailBody: string;
  source: "template" | "claude";
  angle: Angle;
}

export function openerFromTemplate(templates: Template[], angle: Angle, company: Company, person: Person | null, dataSourceLine = false): Opener {
  const tpl = templateFor(templates, angle);
  const vars = templateVars(company, person);
  const emailBody = fill(tpl.emailBody, vars);
  return {
    connectionNote: fill(tpl.connectionNote, vars).slice(0, 300),
    message: fill(tpl.message, vars).slice(0, 700),
    emailSubject: fill(tpl.emailSubject, vars),
    emailBody: dataSourceLine ? `${emailBody}\n\n${DATA_SOURCE_LINE}` : emailBody,
    source: "template",
    angle,
  };
}

export { ANGLE_LABEL };
