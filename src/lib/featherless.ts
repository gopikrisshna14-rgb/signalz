import "server-only";

// Featherless.ai: open-weight models behind an OpenAI-compatible API.
// https://featherless.ai/docs/quickstart-guide
const BASE_URL = "https://api.featherless.ai/v1";
export const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL || "Qwen/Qwen2.5-7B-Instruct";

export const hasFeatherless = () => Boolean(process.env.FEATHERLESS_API_KEY);

export class FeatherlessError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) throw new FeatherlessError("FEATHERLESS_API_KEY is not set", 503);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FEATHERLESS_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.6,
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new FeatherlessError(`Featherless returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new FeatherlessError("Featherless returned an empty answer");
  return text;
}

/** Pull the first JSON object out of a model answer (models sometimes wrap it in prose or ```json fences). */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
