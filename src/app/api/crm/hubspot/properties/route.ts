import { ApiError, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/context";
import { createProperties, HubspotError } from "@/lib/crm/hubspot";
import { decrypt } from "@/lib/crypto";
import { getStore } from "@/lib/store";

/** Admin: create the Signalz property group and custom properties in HubSpot. */
export const POST = route(async () => {
  const ctx = await requireAdmin();
  const store = await getStore();
  const cfg = await store.getHubspot(ctx.org.id);
  if (!cfg) throw new ApiError(400, "not_connected", "Connect HubSpot first");
  try {
    const r = await createProperties(decrypt(cfg.tokenEnc));
    await store.putHubspot(ctx.org.id, { ...cfg, propertiesCreatedAt: new Date().toISOString() });
    await audit(store, ctx.org.id, ctx.user, "hubspot.properties", null, `${r.created} created, ${r.existing} existed`);
    return json(r);
  } catch (e) {
    throw new ApiError(502, "hubspot_error", e instanceof HubspotError ? e.message : "HubSpot request failed");
  }
});
