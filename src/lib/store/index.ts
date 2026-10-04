import "server-only";
import { DEMO_EMAIL, DEMO_ORG_ID, DEMO_USER_ID, seedDemo } from "@/lib/demo";
import type { Org, User } from "@/lib/types";
import { MemoryKv, redisEnv, UpstashKv } from "./kv";
import { KvStore, type Store } from "./store";

export type { Store } from "./store";

const g = globalThis as unknown as { __signalzStore?: Promise<Store> };

export function storeMode(): "redis" | "memory" {
  return redisEnv() ? "redis" : "memory";
}

/** The app's single data access point: Redis when configured, else an in-memory store with demo data. */
export function getStore(): Promise<Store> {
  if (!g.__signalzStore) {
    const env = redisEnv();
    g.__signalzStore = env
      ? Promise.resolve(new KvStore(new UpstashKv(env.url, env.token)))
      : (async () => {
          const store = new KvStore(new MemoryKv());
          await ensureDemoWorkspace(store);
          return store;
        })();
  }
  return g.__signalzStore;
}

/** Creates the demo user and the seeded demo workspace if they do not exist yet. */
export async function ensureDemoWorkspace(store: Store): Promise<User> {
  const now = new Date().toISOString();
  let user = await store.getUser(DEMO_USER_ID);
  if (!user) {
    user = { id: DEMO_USER_ID, email: DEMO_EMAIL, name: "Demo User", image: null, defaultOrgId: DEMO_ORG_ID, createdAt: now };
    await store.putUser(user);
  }
  if (!(await store.getOrg(DEMO_ORG_ID))) {
    const org: Org = {
      id: DEMO_ORG_ID,
      name: "Demo workspace",
      slug: "demo",
      emailDomain: null,
      autoJoin: false,
      seatLimit: 5,
      plan: "beta",
      isDemo: true,
      createdAt: now,
    };
    await store.putOrg(org);
    await store.setMember(DEMO_ORG_ID, DEMO_USER_ID, { role: "owner", status: "active", joinedAt: now });
    await seedDemo(store, DEMO_ORG_ID, { withTeam: true });
  }
  return user;
}
