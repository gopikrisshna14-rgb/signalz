import "server-only";
import { createHmac } from "node:crypto";

export const hasN8n = () => Boolean(process.env.N8N_RESEARCH_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET);

export interface ResearchJob {
  request_id: string;
  org_id: string;
  linkedin_url: string;
  kind: "person" | "company";
}

/**
 * POST one research job to the n8n webhook. The body is signed:
 * X-Signature = hex(HMAC-SHA256(N8N_WEBHOOK_SECRET, raw body)), and sent_at lets n8n reject old replays.
 */
export async function sendToN8n(job: ResearchJob): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.N8N_RESEARCH_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) return { ok: false, error: "The research workflow is not connected yet (N8N_RESEARCH_WEBHOOK_URL)." };

  const body = JSON.stringify({ ...job, sent_at: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": signature },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `The research workflow answered ${res.status}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Could not reach the research workflow: ${(e as Error).message}` };
  }
}
