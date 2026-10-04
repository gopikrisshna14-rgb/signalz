import "server-only";
import { loadCompanies, recomputeAndSave } from "@/lib/accounts";
import { matchExclusion } from "@/lib/pipeline/rules";
import type { Store } from "@/lib/store/store";
import type { Job, Settings } from "@/lib/types";

/** Re-applies the workspace's exclusion regexes to a job (Claude's own exclusions are kept). */
export function reapplyExclusions(job: Job, settings: Settings): Job {
  const hit = matchExclusion(job.title, settings.exclusions);
  if (hit) return { ...job, cls: { ...job.cls, isExcluded: true, exclusionReason: `Matches exclusion “${hit}” (shop-floor, store or call-center staff)` } };
  const regexReason = job.cls.exclusionReason?.startsWith("Matches exclusion");
  if (job.cls.isExcluded && (job.cls.by === "rules" || regexReason)) return { ...job, cls: { ...job.cls, isExcluded: false, exclusionReason: null } };
  return job;
}

export async function rescoreAll(store: Store, orgId: string): Promise<number> {
  const settings = await store.getSettings(orgId);
  const companies = await loadCompanies(store, orgId);
  for (const c of companies)
    await store.withCompanyLock(c.id, async () => {
      const fresh = await store.getCompany(c.id);
      if (fresh) await recomputeAndSave(store, { ...fresh, jobs: fresh.jobs.map((j) => reapplyExclusions(j, settings)) }, settings);
    });
  return companies.length;
}
