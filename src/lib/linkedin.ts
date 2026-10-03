export type LinkedInKind = "person" | "company";

/**
 * Normalise a pasted LinkedIn URL to https://www.linkedin.com/in/<slug> or /company/<slug>.
 * Accepts missing protocol, country subdomains (de.linkedin.com), trailing paths and query strings.
 */
export function normalizeLinkedIn(raw: string): { url: string; kind: LinkedInKind } | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/(in|company)\/([^/?#]+)/i);
  if (!m) return null;
  let slug = m[2]!;
  try {
    slug = decodeURIComponent(slug);
  } catch {}
  slug = slug.trim();
  if (!slug) return null;
  const kind: LinkedInKind = m[1]!.toLowerCase() === "in" ? "person" : "company";
  return { url: `https://www.linkedin.com/${kind === "person" ? "in" : "company"}/${encodeURIComponent(slug)}`, kind };
}
