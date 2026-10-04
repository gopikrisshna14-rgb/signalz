import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { loadCompanies } from "@/lib/accounts";
import { pageCtx } from "@/lib/auth/context";
import { DEFAULT_MAPPING } from "@/lib/crm/hubspot";
import { encryptionEnabled } from "@/lib/crypto";
import { anthropicEnabled, anthropicModel, apifyEnabled, appUrl } from "@/lib/env";
import { ACTOR_RECOMMENDATIONS, actorId, recentRuns, type ActorKind } from "@/lib/pipeline/apify";
import { getStore } from "@/lib/store";
import { memberList } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await pageCtx();
  const store = await getStore();
  const orgId = ctx.org.id;
  const [members, invites, settings, scans, audit, hubspot, research, companies] = await Promise.all([
    memberList(store, orgId),
    ctx.isAdmin ? store.listInvites(orgId) : Promise.resolve([]),
    store.getSettings(orgId),
    store.listScans(orgId, 50),
    ctx.isAdmin ? store.listAudit(orgId, 300) : Promise.resolve([]),
    store.getHubspot(orgId),
    store.listResearch(orgId, 500),
    loadCompanies(store, orgId),
  ]);
  let runs = null;
  let runsError: string | null = null;
  if (apifyEnabled() && ctx.isAdmin) {
    try {
      runs = await recentRuns(10);
    } catch (e) {
      runsError = e instanceof Error ? e.message : "Could not load runs";
    }
  }
  const base = appUrl();
  return (
    <SettingsView
      me={{ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, timezone: ctx.user.timezone ?? null }}
      org={ctx.org}
      role={ctx.role}
      members={members}
      invites={invites.map((i) => ({ ...i, url: `${base}/invite/${i.token}` }))}
      settings={settings}
      scans={scans}
      audit={audit}
      apify={apifyEnabled()}
      sources={{
        apify: apifyEnabled(),
        webhookSecret: Boolean(process.env.APIFY_WEBHOOK_SECRET),
        claude: anthropicEnabled(),
        model: anthropicModel(),
        actors: (Object.keys(ACTOR_RECOMMENDATIONS) as ActorKind[]).map((k) => ({
          kind: k,
          ...ACTOR_RECOMMENDATIONS[k],
          inUse: actorId(k),
          fromEnv: Boolean(process.env[ACTOR_RECOMMENDATIONS[k].env]),
        })),
        runs,
        runsError,
        researchCost: research.reduce((a, r) => a + r.costUsd, 0),
        researchCount: research.length,
      }}
      hubspot={{ connected: Boolean(hubspot), connectedAt: hubspot?.connectedAt ?? null, propertiesCreatedAt: hubspot?.propertiesCreatedAt ?? null, mapping: { ...DEFAULT_MAPPING, ...(hubspot?.mapping ?? {}) }, encryption: encryptionEnabled() }}
      accounts={companies.filter((c) => c.score).map((c) => ({ id: c.id, name: c.name, tier: c.score!.tier, inHubspot: Boolean(c.crm.hubspotCompanyId) }))}
    />
  );
}
