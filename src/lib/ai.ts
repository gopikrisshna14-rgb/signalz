import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { anthropicEnabled, anthropicModel } from "@/lib/env";

/** Models that accept server-side refusal fallbacks in the "default" form. */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export type StructuredResult<T> = { ok: true; data: T } | { ok: false; reason: "disabled" | "refusal" | "invalid" | "error"; message?: string };

/**
 * One structured-output call. Returns { ok: false } on refusal, unparsable output or API errors, so
 * callers can fall back to rules or templates. Never throws.
 */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  user: string;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<StructuredResult<z.infer<S>>> {
  if (!anthropicEnabled()) return { ok: false, reason: "disabled" };
  const model = anthropicModel();
  const base = {
    model,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.user }],
  };
  try {
    if (FALLBACK_MODELS.has(model)) {
      // Server-side fallback: if the model declines, the API re-runs the request on a fallback model.
      const res = await getClient().beta.messages.parse({
        ...base,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      });
      if (res.stop_reason === "refusal") return { ok: false, reason: "refusal" };
      if (res.parsed_output == null) return { ok: false, reason: "invalid" };
      return { ok: true, data: res.parsed_output as z.infer<S> };
    }
    const res = await getClient().messages.parse({
      ...base,
      output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal") return { ok: false, reason: "refusal" };
    if (res.parsed_output == null) return { ok: false, reason: "invalid" };
    return { ok: true, data: res.parsed_output as z.infer<S> };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude API error ${e.status}:`, e.message);
      return { ok: false, reason: "error", message: e.message };
    }
    console.error("Claude call failed:", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
