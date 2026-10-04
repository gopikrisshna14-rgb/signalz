export type LinkedInKind = "person" | "company";

export interface NormalizedUrl {
  kind: LinkedInKind;
  slug: string;
  url: string;
}

/**
 * Normalises a LinkedIn person or company URL to https://www.linkedin.com/in/<slug> or /company/<slug>.
 * Accepts country subdomains (de.linkedin.com), a missing protocol, query strings, fragments and sub-pages.
 */
export function normalizeLinkedInUrl(input: string): NormalizedUrl | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw.replace(/^\/+/, "")}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const i = parts.findIndex((p) => ["in", "company", "pub", "showcase"].includes(p.toLowerCase()));
  if (i === -1 || !parts[i + 1]) return null;
  const type = parts[i].toLowerCase();
  let slug: string;
  try {
    slug = decodeURIComponent(parts[i + 1]).toLowerCase();
  } catch {
    slug = parts[i + 1].toLowerCase();
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_.%-]*$/u.test(slug)) return null;
  const kind: LinkedInKind = type === "in" || type === "pub" ? "person" : "company";
  const path = kind === "person" ? "in" : "company";
  return { kind, slug, url: `https://www.linkedin.com/${path}/${encodeURIComponent(slug).replace(/%2D/gi, "-")}` };
}

/** Key used to dedupe companies: normalised LinkedIn company URL, else the bare domain. */
export function companyKey(input: { linkedinUrl?: string | null; domain?: string | null }): string[] {
  const keys: string[] = [];
  const n = input.linkedinUrl ? normalizeLinkedInUrl(input.linkedinUrl) : null;
  if (n?.kind === "company") keys.push(n.url);
  const d = normalizeDomain(input.domain);
  if (d) keys.push(d);
  return keys;
}

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function slugToName(slug: string): string {
  return slug
    .replace(/-[0-9a-f]{6,}$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
