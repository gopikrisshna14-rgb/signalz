import { describe, expect, it } from "vitest";
import {
  businessUnit,
  classifyJobByRules,
  classifyPersonByRules,
  countryFromLocation,
  crmMentions,
  employerIdentified,
  jobFlags,
  matchExclusion,
  regionFor,
  roleFamily,
  seniority,
} from "@/lib/pipeline/rules";
import { DEFAULT_EXCLUSIONS } from "@/lib/types";

const excluded = (title: string) => matchExclusion(title, DEFAULT_EXCLUSIONS) !== null;

describe("exclusions", () => {
  it.each([
    ["Sales Associate, Store Berlin", true],
    ["Sales Associate Store Berlin", true],
    ["Store Manager Hamburg", true],
    ["Mitarbeiter Filiale München", true],
    ["Shop Assistant (m/w/d)", true],
    ["Shopmitarbeiter Teilzeit", true],
    ["Retail Sales Associate", true],
    ["Retail Associate Weekend", true],
    ["Sales Assistant", true],
    ["Verkäufer (m/w/d) Sportartikel", true],
    ["Kassierer/in", true],
    ["Cashier", true],
    ["Call Center Agent", true],
    ["Callcenter Mitarbeiter", true],
    ["Call Centre Representative", true],
    ["Promoter Verkostung", true],
    ["Aushilfe Lager", true],
    ["Minijob Verkauf", true],
  ])("%s → excluded=%s", (title, expected) => {
    expect(excluded(title)).toBe(expected);
  });

  it.each(["Key Account Manager Retail", "AE Retail Partnerships", "Account Executive Retail Partnerships", "Sales Development Representative", "Head of Sales DACH"])(
    "%s still counts",
    (title) => {
      expect(excluded(title)).toBe(false);
    },
  );

  it("is case-insensitive", () => {
    expect(excluded("SALES ASSOCIATE, STORE BERLIN")).toBe(true);
  });

  it("skips invalid patterns instead of throwing", () => {
    expect(matchExclusion("Store Manager", ["(unclosed", String.raw`\bstores?\b`])).toBe(String.raw`\bstores?\b`);
  });
});

describe("role family and seniority", () => {
  it.each([
    ["SDR Wholesale DACH", "sdr"],
    ["Sales Development Representative (m/w/d)", "sdr"],
    ["Business Development Representative Mid-Market", "sdr"],
    ["Account Executive Wholesale DACH", "ae"],
    ["Head of Sales DACH", "leader"],
    ["VP Sales", "leader"],
    ["Chief Revenue Officer", "leader"],
    ["Head of RevOps", "leader"],
    ["Vertriebsleiterin", "leader"],
    ["Sales Team Lead Wholesale DACH", "leader"],
    ["RevOps Manager", "revops"],
    ["Salesforce Administrator", "revops"],
    ["Key Account Manager Retail", "am"],
    ["Customer Success Manager", "cs"],
  ])("%s → %s", (title, family) => {
    expect(roleFamily(title)).toBe(family);
  });

  it("detects seniority", () => {
    expect(seniority("Chief Revenue Officer")).toBe("c_level");
    expect(seniority("VP Sales")).toBe("vp");
    expect(seniority("Head of Sales")).toBe("head");
    expect(seniority("Senior Account Executive")).toBe("senior");
    expect(seniority("Junior SDR")).toBe("entry");
    expect(seniority("Account Executive")).toBe("mid");
  });
});

describe("division parts", () => {
  it("finds business units", () => {
    expect(businessUnit("SDR Wholesale DACH")).toBe("Wholesale");
    expect(businessUnit("Key Account Manager Retail")).toBe("Retail Partnerships");
    expect(businessUnit("Account Executive Retail Partnerships")).toBe("Retail Partnerships");
    expect(businessUnit("Sales Associate, Store Berlin")).toBe("Retail Stores");
    expect(businessUnit("Account Executive")).toBeNull();
  });

  it("maps locations to countries and regions", () => {
    expect(countryFromLocation("Berlin, Germany")).toBe("DE");
    expect(countryFromLocation("Wien, Österreich")).toBe("AT");
    expect(countryFromLocation("Zürich, Switzerland")).toBe("CH");
    expect(countryFromLocation("London, United Kingdom")).toBe("GB");
    expect(countryFromLocation("Remote")).toBeNull();
    expect(regionFor("DE")).toBe("DACH");
    expect(regionFor("GB")).toBe("UK&I");
    expect(regionFor(null, "SDR (DACH)")).toBe("DACH");
  });
});

describe("CRM, flags, recruiters", () => {
  it("finds CRM names", () => {
    expect(crmMentions("We use Salesforce and Excel")).toEqual(["salesforce", "spreadsheet"]);
    expect(crmMentions("HubSpot Sales Hub")).toEqual(["hubspot"]);
    expect(crmMentions("Microsoft Dynamics 365, Pipedrive, Zoho")).toEqual(["pipedrive", "dynamics", "zoho"]);
  });

  it("finds build-from-scratch flags in English and German", () => {
    expect(jobFlags("Our first SDR")).toContain("first_sdr");
    expect(jobFlags("Founding Account Executive")).toContain("founding_team");
    expect(jobFlags("build the sales team from scratch")).toContain("build_from_scratch");
    expect(jobFlags("Du baust den Vertrieb von Grund auf mit auf")).toContain("build_from_scratch");
    expect(jobFlags("Vertriebsteam aufbauen")).toContain("build_from_scratch");
    expect(jobFlags("Account Executive")).toEqual([]);
  });

  it("flags recruiter postings without a named employer", () => {
    expect(employerIdentified("Hays AG", "SDR for our client")).toBe(false);
    expect(employerIdentified("Talentbridge Personalberatung", "SDR")).toBe(false);
    expect(employerIdentified("Laufwerk Sneakers", "Für unseren Kunden suchen wir")).toBe(false);
    expect(employerIdentified("Laufwerk Sneakers", "Join our team")).toBe(true);
    expect(employerIdentified(null, "SDR")).toBe(false);
  });
});

describe("classifyJobByRules", () => {
  it("classifies the sneaker example", () => {
    const j = classifyJobByRules({ title: "SDR Wholesale DACH", location: "Berlin, Germany", description: "Salesforce", employerName: "Laufwerk" }, DEFAULT_EXCLUSIONS);
    expect(j).toMatchObject({ function: "sales", businessUnit: "Wholesale", region: "DACH", roleFamily: "sdr", crmMentions: ["salesforce"], isExcluded: false, employerIdentified: true });
    const store = classifyJobByRules({ title: "Sales Associate, Store Berlin", location: "Berlin, Germany", employerName: "Laufwerk" }, DEFAULT_EXCLUSIONS);
    expect(store.isExcluded).toBe(true);
    expect(store.exclusionReason).toMatch(/store/);
  });

  it("classifies a person with prior tools", () => {
    const p = classifyPersonByRules({ title: "Head of Sales DACH", location: "Berlin", previousRoles: [{ company: "Urban Run", title: "Sales Director", description: "Rolled out HubSpot" }] });
    expect(p).toMatchObject({ roleFamily: "leader", persona: "Economic buyer", isDecisionMaker: true, priorTools: ["hubspot"] });
  });
});
