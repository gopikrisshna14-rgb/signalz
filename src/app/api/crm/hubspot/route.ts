import { z } from "zod";
import { ApiError, body, json, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireAdmin, requireMember } from "@/lib/auth/context";
import { DEFAULT_MAPPING, hs, HubspotError } from "@/lib/crm/hubspot";
import { encrypt, encryptionEnabled } from "@/lib/crypto";
import { getStore } from "@/lib/store";

export const GET = route(async () => {
  const ctx = await requireMember();
  const store = await getStore();
  const cfg = await store.getHubspot(ctx.org.id);
  return json({ connected: Boolean(cfg), connectedAt: cfg?.connectedAt ?? null, propertiesCreatedAt: cfg?.propertiesCreatedAt ?? null, mapping: { ...DEFAULT_MAPPING, ...(cfg?.mapping ?? {}) }, encryption: encryptionEnabled() });
});

/** Admin: connect with a private-app token (stored AES-256-GCM encrypted). */
export const POST = route(async (req: Request) => {
  const ctx = await requireAdmin();
  if (!encryptionEnabled()) throw new ApiError(400, "no_encryption_key", "Set ENCRYPTION_KEY in Vercel before storing a HubSpot token");
  const { token } = await body(req, z.object({ token: z.string().trim().min(10).max(500) }));
  try {
    await hs(token, "/crm/v3/objects/companies?limit=1");
  } catch (e) {
    throw new ApiError(400, "hubspot_rejected", e instanceof HubspotError ? `HubSpot rejected the token: ${e.message}` : "Could not reach HubSpot");
  }
  const store = await getStore();
  const prev = await store.getHubspot(ctx.org.id);
  await store.putHubspot(ctx.org.id, { tokenEnc: encrypt(token), connectedAt: new Date().toISOString(), propertiesCreatedAt: prev?.propertiesCreatedAt ?? null, mapping: prev?.mapping ?? {} });
  await audit(store, ctx.org.id, ctx.user, "hubspot.connected");
  return json({ connected: true });
});

/** Admin: save the field mapping. */
export const PATCH = route(async (req: Request) => {
  const ctx = await requireAdmin();
  const { mapping } = await body(req, z.object({ mapping: z.record(z.string(), z.string().max(100).regex(/^[a-z0-9_]*$/, "HubSpot property names use a-z, 0-9 and _")) }));
  const store = await getStore();
  const cfg = await store.getHubspot(ctx.org.id);
  if (!cfg) throw new ApiError(400, "not_connected", "Connect HubSpot first");
  await store.putHubspot(ctx.org.id, { ...cfg, mapping });
  await audit(store, ctx.org.id, ctx.user, "hubspot.mapping");
  return json({ ok: true });
});

export const DELETE = route(async () => {
  const ctx = await requireAdmin();
  const store = await getStore();
  await store.putHubspot(ctx.org.id, null);
  await audit(store, ctx.org.id, ctx.user, "hubspot.disconnected");
  return json({ connected: false });
});
