import { describe, expect, it } from "vitest";
import { companyFixture, jobsFixture, profileFixture } from "@/lib/pipeline/fixtures";
import { mapCompany, mapJob, mapPerson, normCount, normDate, normGrowth, pick } from "@/lib/pipeline/mappers";

const NOW = new Date("2026-10-04T12:00:00Z");
const day = (iso: string | null) => iso?.slice(0, 10);

describe("pick", () => {
  it("returns the first non-empty path", () => {
    expect(pick({ a: "", b: { c: [null, "x"] } }, "a", "b.c.1")).toBe("x");
    expect(pick({ a: [] }, "a", "missing")).toBeUndefined();
  });
});

describe("normDate", () => {
  it.each([
    ["3 days ago", "2026-10-01"],
    ["vor 2 Tagen", "2026-10-02"],
    ["vor einer Woche", "2026-09-27"],
    ["1 week ago", "2026-09-27"],
    ["2 months ago", "2026-08-05"],
    ["30+ days ago", "2026-09-04"],
    ["today", "2026-10-04"],
    ["gestern", "2026-10-03"],
    ["5d", "2026-09-29"],
    ["2026-09-15T08:00:00Z", "2026-09-15"],
    ["2024-05", "2024-05-01"],
    ["Mar 2024", "2024-03-01"],
    ["März 2024", "2024-03-01"],
    ["15.08.2026", "2026-08-15"],
  ])("%s → %s", (input, expected) => {
    expect(day(normDate(input, NOW))).toBe(expected);
  });

  it("handles objects and epochs", () => {
    expect(day(normDate({ year: 2026, month: 9, day: 13 }, NOW))).toBe("2026-09-13");
    expect(day(normDate({ year: 2020 }, NOW))).toBe("2020-01-01");
    expect(day(normDate(1788566400, NOW))).toBe(day(new Date(1788566400 * 1000).toISOString()));
    expect(day(normDate(1788566400000, NOW))).toBe(day(new Date(1788566400000).toISOString()));
    expect(normDate(null, NOW)).toBeNull();
    expect(normDate("garbage", NOW)).toBeNull();
  });
});

describe("normCount", () => {
  it.each([
    ["201-500", 201],
    ["1,200", 1200],
    ["1.200", 1200],
    ["10,001+", 10001],
    ["1.2K", 1200],
    ["51-200 employees", 51],
    [420, 420],
  ] as const)("%s → %s", (input, expected) => {
    expect(normCount(input)).toBe(expected);
  });
  it("handles ranges as objects and nonsense", () => {
    expect(normCount({ start: 51, end: 200 })).toBe(51);
    expect(normCount("n/a")).toBeNull();
  });
  it("normalises growth", () => {
    expect(normGrowth("18%")).toBe(0.18);
    expect(normGrowth(0.12)).toBe(0.12);
    expect(normGrowth(25)).toBe(0.25);
  });
});

describe("mapPerson", () => {
  it("maps the profile fixture with the current role start date and company URL", () => {
    const p = mapPerson(profileFixture("jonas-weber", NOW)[0], NOW);
    expect(p.name).toBe("Jonas Weber");
    expect(p.title).toBe("Head of Sales DACH");
    expect(p.country).toBe("DE");
    expect(p.currentCompanyUrl).toMatch(/^https:\/\/www\.linkedin\.com\/company\//);
    expect(day(p.roleStartedAt)).toBe("2026-08-30");
    expect(p.previousRoles[0]).toMatchObject({ company: "Shopfabrik GmbH", title: "Sales Director E-Commerce" });
    expect(p.skills).toContain("HubSpot");
  });

  it("reads other actors' field names", () => {
    const p = mapPerson(
      { first_name: "Lea", last_name: "Schmidt", occupation: "VP Sales", location: { default: "Wien, Österreich" }, positions: [{ title: "VP Sales", company: { name: "Acme", url: "https://at.linkedin.com/company/acme" }, timePeriod: { startDate: { year: 2026, month: 8 } } }] },
      NOW,
    );
    expect(p.name).toBe("Lea Schmidt");
    expect(p.country).toBe("AT");
    expect(p.currentCompanyUrl).toBe("https://www.linkedin.com/company/acme");
    expect(day(p.roleStartedAt)).toBe("2026-08-01");
  });
});

describe("mapCompany and mapJob", () => {
  it("maps the company fixture", () => {
    const c = mapCompany(companyFixture("nordlicht-commerce")[0], NOW);
    expect(c).toMatchObject({ name: "Nordlicht Commerce", headcount: 201, headcountGrowth6m: 0.14, country: "DE", city: "Munich", domain: "nordlichtcommerce.de" });
    expect(c.linkedinId).toMatch(/^\d+$/);
  });

  it("maps jobs with different field names", () => {
    const jobs = jobsFixture("Nordlicht Commerce", "nordlicht-commerce", NOW).map((j) => mapJob(j, NOW)!);
    expect(jobs.map((j) => j.title)).toContain("Business Development Representative E-Commerce");
    expect(jobs.every((j) => j.externalId && j.postedAt)).toBe(true);
    expect(jobs.find((j) => j.title.startsWith("Business"))!.employerName).toBe("Nordlicht Commerce");
    expect(day(jobs.find((j) => j.title.startsWith("Account"))!.postedAt)).toBe("2026-09-26");
  });

  it("skips items without a title", () => {
    expect(mapJob({ id: "1" }, NOW)).toBeNull();
  });
});
