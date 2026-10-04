import { newId } from "@/lib/ids";
import type { Store } from "@/lib/store/store";
import type { User } from "@/lib/types";

export async function audit(store: Store, orgId: string, user: Pick<User, "id" | "name">, action: string, target: string | null = null, detail: string | null = null) {
  await store.addAudit(orgId, { id: newId("aud"), at: new Date().toISOString(), userId: user.id, userName: user.name, action, target, detail });
}
