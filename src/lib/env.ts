/** Public base URL of the app (Apify callbacks, invite links). */
export function appUrl(req?: Request): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}

export const anthropicEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const anthropicModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const apifyEnabled = () => Boolean(process.env.APIFY_TOKEN);
export const researchLimitPerDay = () => Number(process.env.RESEARCH_LIMIT_PER_DAY || 50);
