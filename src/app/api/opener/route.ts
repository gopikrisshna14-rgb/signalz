import { z } from "zod";
import { structured } from "@/lib/ai";
import { ApiError, body, json, route } from "@/lib/api";
import { requireCompany } from "@/lib/auth/context";
import { anthropicEnabled } from "@/lib/env";
import { daysAgo } from "@/lib/format";
import { CRM_LABEL } from "@/lib/pipeline/rules";
import { DATA_SOURCE_LINE, divisionPhrase, openerFromTemplate, type Opener } from "@/lib/templates";
import { languageFor } from "@/lib/language";
import { Angle, ANGLE_LABEL } from "@/lib/types";

export const maxDuration = 120;

const Out = z.object({
  connection_note: z.string(),
  first_message: z.string(),
  email_subject: z.string(),
  email_body: z.string(),
});

export const POST = route(async (req: Request) => {
  const input = await body(req, z.object({ companyId: z.string(), personId: z.string().nullable().optional(), angle: Angle }));
  const { company, ctx, store } = await requireCompany(input.companyId);
  const [templates, settings] = await Promise.all([store.getTemplates(company.orgId), store.getSettings(company.orgId)]);
  const person = company.people.find((p) => p.id === input.personId) ?? company.people.find((p) => p.id === company.score?.decisionMakerId) ?? null;
  const fallback = openerFromTemplate(templates, input.angle, company, person, settings.dataSourceLine);
  if (!anthropicEnabled()) return json({ opener: fallback, reason: "no_api_key" });

  const n = await store.hit(`opener:${ctx.user.id}:${new Date().toISOString().slice(0, 10)}`, 86_400);
  if (n > 200) throw new ApiError(429, "rate_limited", "Daily limit for AI openers reached");

  const lang = languageFor(company.country, person);
  const facts = [
    `Company: ${company.name} (${company.industry ?? "industry unknown"}, ${company.headcount ?? "?"} employees, ${company.city ?? ""} ${company.country ?? ""})`,
    `Division to talk about: ${divisionPhrase(company)} (${company.clusters[0]?.label ?? "no cluster"})`,
    `Why now:\n${(company.score?.reasons ?? []).map((r) => `- ${r}`).join("\n")}`,
    person
      ? `Recipient: ${person.name}, ${person.title}, ${daysAgo(person.roleStartedAt) ?? "?"} days in the role. Previously: ${person.previousRoles
          .slice(0, 3)
          .map((r) => `${r.title} at ${r.company}`)
          .join("; ") || "unknown"}. Tools used before: ${person.cls.priorTools.map((t) => CRM_LABEL[t] ?? t).join(", ") || "unknown"}.`
      : "Recipient: unknown (write to the head of the sales team)",
    person?.posts.length ? `Their last posts:\n${person.posts.slice(0, 3).map((p) => `- (${p.at?.slice(0, 10) ?? "?"}) ${p.text}`).join("\n")}` : "",
    `Angle: ${ANGLE_LABEL[input.angle]}`,
    `Sender sells: ${CRM_LABEL[settings.ownProduct] ?? settings.ownProduct}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await structured({
    schema: Out,
    effort: "medium",
    maxTokens: 6000,
    system: `You write first-touch LinkedIn and e-mail messages for an SDR. Write in ${lang}. Plain and specific: refer to the division and the concrete hiring facts given, never to "your company" in general. Ask exactly one question. No flattery, no buzzwords, no exclamation marks. Never invent facts beyond the ones given. connection_note: at most 300 characters. first_message: at most 700 characters. email_body: short, ends with a sign-off line "Best," and no name. Do not mention that the information came from scraping.`,
    user: facts,
  });
  if (!res.ok) return json({ opener: fallback, reason: res.reason });
  const o = res.data;
  const opener: Opener = {
    connectionNote: o.connection_note.slice(0, 300),
    message: o.first_message.slice(0, 700),
    emailSubject: o.email_subject,
    emailBody: settings.dataSourceLine ? `${o.email_body}\n\n${DATA_SOURCE_LINE}` : o.email_body,
    source: "claude",
    angle: input.angle,
  };
  return json({ opener });
});
