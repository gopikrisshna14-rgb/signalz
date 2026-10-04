import "server-only";
import type { Ctx } from "@/lib/auth/context";
import { anthropicEnabled } from "@/lib/env";
import { notCountedReason } from "@/lib/scoring";
import type { Store } from "@/lib/store/store";
import { defaultTemplates } from "@/lib/templates";
import type { Angle, Company, OutreachEvent, Template } from "@/lib/types";

export interface AngleStat {
  sent: number;
  replied: number;
  rate: number | null;
}

export function angleStats(events: OutreachEvent[]): Record<Angle, AngleStat> {
  const out = {} as Record<Angle, AngleStat>;
  for (const angle of ["first_90_days", "team_buildout", "crm_displacement", "expansion"] as Angle[]) {
    const evs = events.filter((e) => e.angle === angle);
    const sent = new Set(evs.filter((e) => e.type === "connection_sent" || e.type === "message_sent").map((e) => `${e.companyId}:${e.personId}`));
    const replied = new Set(evs.filter((e) => e.type === "replied" || e.type === "meeting_booked").map((e) => `${e.companyId}:${e.personId}`));
    out[angle] = { sent: sent.size, replied: replied.size, rate: sent.size ? replied.size / sent.size : null };
  }
  return out;
}

/** Postings per week for the last 12 weeks, per cluster. */
export function weeklyHeat(company: Company, now = new Date()): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const c of company.clusters) {
    const weeks = Array(12).fill(0) as number[];
    for (const j of company.jobs.filter((x) => c.jobIds.includes(x.id))) {
      const t = Date.parse(j.postedAt ?? j.firstSeenAt);
      const w = Math.floor((now.getTime() - t) / (7 * 86_400_000));
      if (w >= 0 && w < 12) weeks[11 - w] += 1;
    }
    out[c.key] = weeks;
  }
  return out;
}

export async function accountDetail(store: Store, company: Company, ctx: Ctx) {
  const now = new Date();
  const [settings, outreach, orgOutreach, templatesRaw, members, hubspot] = await Promise.all([
    store.getSettings(company.orgId),
    store.listCompanyOutreach(company.id),
    store.listOutreach(company.orgId, 2000),
    store.getTemplates(company.orgId),
    store.getMembers(company.orgId),
    store.getHubspot(company.orgId),
  ]);
  const templates: Template[] = templatesRaw.length ? templatesRaw : defaultTemplates();
  const names = await Promise.all(Object.keys(members).map(async (id) => ({ userId: id, name: (await store.getUser(id))?.name ?? "Unknown" })));
  return {
    company,
    notCounted: Object.fromEntries(company.jobs.map((j) => [j.id, notCountedReason(j, settings, now)])),
    heat: weeklyHeat(company, now),
    outreach,
    members: names,
    templates,
    angleStats: angleStats(orgOutreach),
    viewer: { id: ctx.user.id, name: ctx.user.name, isAdmin: ctx.isAdmin },
    settings: { leaderTenureDays: settings.leaderTenureDays, ownProduct: settings.ownProduct, clusterWindowDays: settings.clusterWindowDays, dataSourceLine: settings.dataSourceLine },
    aiEnabled: anthropicEnabled(),
    hubspotConnected: Boolean(hubspot),
  };
}

export type AccountDetail = Awaited<ReturnType<typeof accountDetail>>;
