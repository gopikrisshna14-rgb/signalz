import { json, route } from "@/lib/api";
import { requireCron } from "@/lib/cron";
import { getStore } from "@/lib/store";

const KEEP_MS = 180 * 86_400_000;

/** Weekly (GDPR): drop LinkedIn posts and raw job texts older than 180 days. */
export const GET = route(async (req: Request) => {
  requireCron(req);
  const store = await getStore();
  const cutoff = Date.now() - KEEP_MS;
  let touched = 0;
  for (const orgId of await store.listOrgIds()) {
    for (const c of await store.listCompanies(orgId)) {
      let changed = false;
      const people = c.people.map((p) => {
        const posts = p.posts.filter((x) => x.at && Date.parse(x.at) >= cutoff);
        if (posts.length !== p.posts.length) changed = true;
        return { ...p, posts };
      });
      const jobs = c.jobs.map((j) => {
        if (j.description && Date.parse(j.lastSeenAt) < cutoff) {
          changed = true;
          return { ...j, description: null };
        }
        return j;
      });
      if (changed) {
        await store.withCompanyLock(c.id, async () => {
          const fresh = await store.getCompany(c.id);
          if (fresh) await store.putCompany({ ...fresh, people, jobs });
        });
        touched++;
      }
    }
  }
  return json({ touched });
});
