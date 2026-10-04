import { describe, expect, it } from "vitest";
import { companyKey, normalizeDomain, normalizeLinkedInUrl } from "@/lib/linkedin";

describe("normalizeLinkedInUrl", () => {
  it.each([
    ["https://www.linkedin.com/in/jonas-weber", "person", "https://www.linkedin.com/in/jonas-weber"],
    ["https://de.linkedin.com/in/Jonas-Weber/", "person", "https://www.linkedin.com/in/jonas-weber"],
    ["linkedin.com/in/jonas-weber?utm_source=share&trk=x", "person", "https://www.linkedin.com/in/jonas-weber"],
    ["www.linkedin.com/in/jonas-weber/details/experience/", "person", "https://www.linkedin.com/in/jonas-weber"],
    ["http://ch.linkedin.com/company/laufwerk-sneakers/about/", "company", "https://www.linkedin.com/company/laufwerk-sneakers"],
    ["https://www.linkedin.com/company/laufwerk-sneakers/jobs/#top", "company", "https://www.linkedin.com/company/laufwerk-sneakers"],
    ["https://www.linkedin.com/showcase/laufwerk-wholesale", "company", "https://www.linkedin.com/company/laufwerk-wholesale"],
    ["https://www.linkedin.com/in/j%C3%BCrgen-m%C3%BCller", "person", "https://www.linkedin.com/in/j%C3%BCrgen-m%C3%BCller"],
  ])("%s", (input, kind, url) => {
    const n = normalizeLinkedInUrl(input);
    expect(n?.kind).toBe(kind);
    expect(n?.url).toBe(url);
  });

  it.each(["https://example.com/in/jonas", "https://www.linkedin.com/feed/", "https://www.linkedin.com/jobs/view/123", "not a url", "", "https://evil-linkedin.com/in/x"])("rejects %s", (input) => {
    expect(normalizeLinkedInUrl(input)).toBeNull();
  });
});

describe("company keys", () => {
  it("normalises domains", () => {
    expect(normalizeDomain("https://www.Laufwerk-Sneakers.de/about")).toBe("laufwerk-sneakers.de");
    expect(normalizeDomain("not a domain")).toBeNull();
  });
  it("prefers the LinkedIn URL, then the domain", () => {
    expect(companyKey({ linkedinUrl: "de.linkedin.com/company/laufwerk/", domain: "www.laufwerk.de" })).toEqual(["https://www.linkedin.com/company/laufwerk", "laufwerk.de"]);
  });
});
