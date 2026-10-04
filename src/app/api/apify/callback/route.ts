import { z } from "zod";
import { ApiError, json, route } from "@/lib/api";
import { verify } from "@/lib/pipeline/apify";
import { handleScanCallback } from "@/lib/pipeline/scan";
import { handleResearchCallback } from "@/lib/pipeline/steps";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

const Payload = z
  .object({
    eventType: z.string().optional(),
    resource: z
      .object({ id: z.string().optional(), status: z.string().optional(), statusMessage: z.string().nullish().transform((v) => v ?? undefined), usageTotalUsd: z.number().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Apify ad-hoc webhook. The query carries ?r=<id>&step=<step>&sig=<HMAC> (or ?scan=<id>&step=scan). */
export const POST = route(async (req: Request) => {
  const url = new URL(req.url);
  const r = url.searchParams.get("r");
  const scan = url.searchParams.get("scan");
  const step = url.searchParams.get("step") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const id = r ?? scan;
  if (!id || !step || !verify(id, step, sig)) throw new ApiError(401, "bad_signature", "Invalid signature");
  const payload = Payload.parse(await req.json().catch(() => ({})));
  const store = await getStore();
  const result = scan ? await handleScanCallback(store, id, payload) : await handleResearchCallback(store, id, step, payload);
  return json(result);
});
