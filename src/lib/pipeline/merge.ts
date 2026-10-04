import "server-only";
import { recomputeAndSave } from "@/lib/accounts";
import { newId } from "@/lib/ids";
import { companyKey } from "@/lib/linkedin";
import type { CompanyDraft, JobDraft } from "@/lib/pipeline/mappers";
import type { Store } from "@/lib/store/store";
import type { Company, Job, JobClassification, Person, Signal } from "@/lib/types";

export interface MergeInput {
  orgId: string;
  company: Partial<CompanyDraft> & { name: string };
  /** Extra dedupe key when the employer has no LinkedIn URL or domain (market scans). */
  nameKey?: string | null;
  jobs?: { draft: JobDraft; cls: JobClassification }[];
  jobSource?: string;
  /** Close jobs of this source that are missing from this scrape (never for market scans). */
  closeMissing?: boolean;
  fromScan?: boolean;
  people?: Person[];
  sourceKind: string;
}

const blank = (v: unknown) => v === null || v === undefined || v === "";

/** Upserts a company under the company lock and recomputes its scores. */
export async function mergeCompany(store: Store, input: MergeInput, now = new Date()): Promise<{ company: Company; signals: Signal[]; created: boolean }> {
  const keys = companyKey({ linkedinUrl: input.company.linkedinUrl, domain: input.company.domain });
  if (input.nameKey) keys.push(input.nameKey);
  if (!keys.length) keys.push(`name:${input.company.name.toLowerCase()}`);
  const settings = await store.getSettings(input.orgId);
  const iso = now.toISOString();

  // Lock on the dedupe key first (the company may not exist yet), then on the company id.
  return store.withCompanyLock(`key:${input.orgId}:${keys[0]}`, async () => {
    let id: string | null = null;
    for (const k of keys) {
      id = await store.findCompanyByKey(input.orgId, k);
      if (id) break;
    }
    const companyId = id ?? newId("co");
    return store.withCompanyLock(companyId, async () => {
      const existing = id ? await store.getCompany(companyId) : null;
      const base: Company = existing ?? {
        id: companyId,
        orgId: input.orgId,
        name: input.company.name,
        domain: null,
        linkedinUrl: null,
        linkedinId: null,
        logoUrl: null,
        industry: null,
        headcount: null,
        headcountGrowth6m: null,
        country: null,
        city: null,
        fundingAt: null,
        description: null,
        status: "prospect",
        routedTo: null,
        divisions: [],
        jobs: [],
        people: [],
        clusters: [],
        score: null,
        scoreHistory: [],
        owner: null,
        lastOutreachAt: null,
        crm: { detected: null, exportedAt: null, hubspotCompanyId: null, hubspotContactIds: {} },
        sources: [],
        enrichedAt: null,
        createdAt: iso,
        updatedAt: iso,
      };

      // Never overwrite known fields with blanks.
      const next: Company = { ...base };
      for (const [k, v] of Object.entries(input.company) as [keyof CompanyDraft, unknown][]) {
        if (!blank(v)) (next as unknown as Record<string, unknown>)[k] = v;
      }

      if (input.jobs) {
        const source = input.jobSource ?? "linkedin";
        const byKey = new Map(next.jobs.map((j) => [`${j.source}:${j.externalId}`, j]));
        const seen = new Set<string>();
        for (const { draft, cls } of input.jobs) {
          const key = `${source}:${draft.externalId}`;
          seen.add(key);
          const flags = draft.reposted && !cls.flags.includes("reposted") ? [...cls.flags, "reposted" as const] : cls.flags;
          const prev = byKey.get(key);
          const job: Job = {
            id: prev?.id ?? newId("job"),
            source,
            externalId: draft.externalId,
            title: draft.title,
            url: draft.url ?? prev?.url ?? null,
            location: draft.location ?? prev?.location ?? null,
            country: draft.country ?? prev?.country ?? null,
            city: draft.city ?? prev?.city ?? null,
            description: draft.description ?? prev?.description ?? null,
            employerName: draft.employerName ?? prev?.employerName ?? next.name,
            postedAt: draft.postedAt ?? prev?.postedAt ?? null,
            firstSeenAt: prev?.firstSeenAt ?? iso,
            lastSeenAt: iso,
            closedAt: null,
            fromScan: prev ? prev.fromScan && Boolean(input.fromScan) : Boolean(input.fromScan),
            cls: { ...cls, flags },
          };
          byKey.set(key, job);
        }
        if (input.closeMissing && !input.fromScan)
          for (const [key, j] of byKey) if (j.source === source && !seen.has(key) && !j.closedAt) byKey.set(key, { ...j, closedAt: iso });
        next.jobs = [...byKey.values()];
      }

      if (input.people?.length) {
        const blocked = new Set(settings.doNotScrape.map((x) => x.toLowerCase()));
        const people = [...next.people];
        for (const p of input.people) {
          if ((p.linkedinUrl && blocked.has(p.linkedinUrl.toLowerCase())) || blocked.has(p.name.toLowerCase())) continue;
          const i = people.findIndex((x) => (p.linkedinUrl && x.linkedinUrl === p.linkedinUrl) || x.name.toLowerCase() === p.name.toLowerCase());
          if (i === -1) people.push(p);
          else {
            const merged = { ...people[i] } as Record<string, unknown>;
            for (const [k, v] of Object.entries(p)) if (k !== "id" && !blank(v) && !(Array.isArray(v) && v.length === 0)) merged[k] = v;
            people[i] = merged as unknown as Person;
          }
        }
        next.people = people;
      }

      next.sources = [...next.sources, { kind: input.sourceKind, at: iso }].slice(-20);
      next.enrichedAt = iso;
      for (const k of keys) await store.setCompanyKey(input.orgId, k, companyId);
      if (next.linkedinUrl) await store.setCompanyKey(input.orgId, next.linkedinUrl, companyId);
      if (next.domain) await store.setCompanyKey(input.orgId, next.domain, companyId);
      const { company, signals } = await recomputeAndSave(store, next, settings, now);
      return { company, signals, created: !existing };
    });
  });
}
