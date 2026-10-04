import { newId } from "@/lib/ids";
import { classifyJobByRules, classifyPersonByRules, countryFromLocation, cityFromLocation } from "@/lib/pipeline/rules";
import { recompute } from "@/lib/scoring";
import type { Store } from "@/lib/store/store";
import { defaultTemplates } from "@/lib/templates";
import type {
  Angle,
  Company,
  CompanyStatus,
  Job,
  Membership,
  OutreachEvent,
  OutreachType,
  Person,
  Research,
  Scan,
  Settings,
  Signal,
  User,
} from "@/lib/types";

export const DEMO_USER_ID = "u_demo";
export const DEMO_ORG_ID = "o_demo";
export const DEMO_EMAIL = "demo@signalz.app";

const DAY = 86_400_000;
const ago = (days: number, now: Date, hour = 9) => {
  const d = new Date(now.getTime() - days * DAY);
  d.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
};

/** Teammates in the demo workspace (4 of 5 seats). */
export const DEMO_TEAM: { id: string; name: string; email: string; role: Membership["role"] }[] = [
  { id: DEMO_USER_ID, name: "Demo User", email: DEMO_EMAIL, role: "owner" },
  { id: "u_demo_max", name: "Max Bauer", email: "max.bauer@demo.signalz.app", role: "member" },
  { id: "u_demo_lea", name: "Lea Schmidt", email: "lea.schmidt@demo.signalz.app", role: "admin" },
  { id: "u_demo_tom", name: "Tom Keller", email: "tom.keller@demo.signalz.app", role: "member" },
];

interface JobSpec {
  title: string;
  days: number;
  location?: string;
  desc?: string;
  closed?: boolean;
}

interface PersonSpec {
  name: string;
  title: string;
  started: number | null;
  location?: string;
  previous?: { company: string; title: string; years: string; tools?: string }[];
  skills?: string[];
  posts?: { text: string; days: number }[];
  mutual?: number;
  shared?: string;
  email?: string;
  schools?: string[];
}

interface CompanySpec {
  name: string;
  domain: string;
  industry: string;
  headcount: number | null;
  growth?: number | null;
  location: string;
  funding?: number;
  status?: CompanyStatus;
  owner?: string;
  description: string;
  jobs: JobSpec[];
  people: PersonSpec[];
  lastOutreach?: number;
  exported?: boolean;
}

const SPECS: CompanySpec[] = [
  {
    name: "Laufwerk Sneakers",
    domain: "laufwerk-sneakers.de",
    industry: "Apparel & Footwear",
    headcount: 420,
    growth: 0.18,
    location: "Berlin, Germany",
    funding: 95,
    description: "Sneaker brand from Berlin, sold in 1,200 stores across Europe and online.",
    jobs: [
      {
        title: "Sales Development Representative Wholesale (m/w/d) – DACH",
        days: 4,
        location: "Berlin, Germany",
        desc: "You qualify new wholesale accounts across DACH. Our team works in Salesforce; you will help us build the wholesale team from scratch.",
      },
      { title: "SDR Wholesale DACH", days: 9, location: "Berlin, Germany", desc: "Outbound prospecting to sporting-goods retailers. Salesforce experience is a plus." },
      { title: "Account Executive Wholesale DACH", days: 12, location: "Berlin, Germany", desc: "Own the full cycle with wholesale partners. CRM: Salesforce." },
      { title: "Sales Team Lead Wholesale DACH", days: 16, location: "Berlin, Germany", desc: "Lead and coach our new wholesale sales team." },
      { title: "Sales Associate, Store Berlin", days: 3, location: "Berlin, Germany", desc: "Advise customers in our flagship store." },
      { title: "Key Account Manager Retail (DACH)", days: 8, location: "Munich, Germany", desc: "Manage our largest retail partners such as department stores." },
      { title: "Account Executive Retail Partnerships", days: 11, location: "Berlin, Germany", desc: "Win new retail partners in Germany and Austria." },
      { title: "Werkstudent Social Media", days: 20, location: "Berlin, Germany" },
    ],
    people: [
      {
        name: "Jonas Weber",
        title: "Head of Sales DACH",
        started: 21,
        location: "Berlin, Germany",
        previous: [
          { company: "Urban Run GmbH", title: "Sales Director Wholesale", years: "2020–2026", tools: "Built the sales process in HubSpot Sales Hub" },
          { company: "Sportfreund AG", title: "Key Account Manager", years: "2016–2020" },
        ],
        skills: ["HubSpot", "Wholesale", "Team Leadership"],
        posts: [
          { text: "Week 3 at Laufwerk: we are building a wholesale team across DACH. Hiring SDRs and AEs now!", days: 5 },
          { text: "What is the fastest way you have seen new reps ramp? Collecting ideas for our onboarding.", days: 12 },
          { text: "Thrilled to start as Head of Sales DACH at Laufwerk Sneakers.", days: 21 },
        ],
        mutual: 3,
        shared: "Both worked with Sportfreund AG",
        schools: ["HWR Berlin"],
      },
      { name: "Clara Hoffmann", title: "Head of E-Commerce", started: 400, location: "Berlin, Germany" },
    ],
  },
  {
    name: "Nordwind Logistics",
    domain: "nordwind-logistics.de",
    industry: "Logistics",
    headcount: 780,
    growth: 0.12,
    location: "Hamburg, Germany",
    description: "Freight forwarding for mid-sized manufacturers in Northern Europe.",
    jobs: [
      { title: "Business Development Representative Mid-Market", days: 6, location: "Hamburg, Germany", desc: "We currently use Pipedrive and are moving to a scalable CRM." },
      { title: "BDR Mid-Market (DACH)", days: 10, location: "Hamburg, Germany", desc: "Pipedrive, LinkedIn Sales Navigator." },
      { title: "Account Executive Mid-Market", days: 18, location: "Hamburg, Germany" },
      { title: "RevOps Manager Mid-Market", days: 13, location: "Hamburg, Germany", desc: "Own our CRM, Pipedrive today." },
    ],
    people: [
      {
        name: "Svenja Lorenz",
        title: "Head of RevOps",
        started: 38,
        location: "Hamburg, Germany",
        previous: [{ company: "Cargoboard", title: "Sales Operations Lead", years: "2021–2026", tools: "Salesforce admin" }],
        skills: ["Salesforce", "RevOps"],
        posts: [{ text: "Hiring a RevOps Manager to join my team in Hamburg.", days: 9 }],
        mutual: 6,
        email: "svenja.lorenz@nordwind-logistics.de",
      },
    ],
  },
  {
    name: "Sonnenstrom Solar",
    domain: "sonnenstrom.de",
    industry: "Renewable Energy",
    headcount: 260,
    growth: 0.22,
    location: "Freiburg, Germany",
    funding: 60,
    description: "Solar installations for SMB rooftops in southern Germany.",
    jobs: [
      { title: "Sales Development Representative SMB", days: 3, location: "Freiburg, Germany", desc: "Our sales team works with Zoho CRM." },
      { title: "SDR SMB (m/w/d)", days: 7, location: "Freiburg, Germany" },
      { title: "Account Executive SMB", days: 15, location: "Freiburg, Germany" },
      { title: "Sales Operations Specialist SMB", days: 20, location: "Freiburg, Germany", desc: "Zoho, reporting, enablement." },
    ],
    people: [
      {
        name: "Mehmet Aydin",
        title: "VP Sales",
        started: 220,
        location: "Freiburg, Germany",
        previous: [{ company: "Enpal", title: "Sales Director", years: "2019–2025", tools: "HubSpot" }],
        skills: ["HubSpot"],
        mutual: 2,
      },
    ],
  },
  {
    name: "Isarpay",
    domain: "isarpay.com",
    industry: "Fintech",
    headcount: 350,
    growth: 0.09,
    location: "Munich, Germany",
    owner: "u_demo_max",
    description: "Payments for marketplaces and platforms.",
    jobs: [
      { title: "SDR Enterprise DACH", days: 5, location: "Munich, Germany", desc: "Salesforce, Outreach." },
      { title: "Sales Development Representative Enterprise", days: 8, location: "Munich, Germany" },
      { title: "Senior Account Executive Enterprise", days: 14, location: "Munich, Germany", desc: "Salesforce" },
      { title: "Head of Sales Enterprise DACH", days: 19, location: "Munich, Germany" },
    ],
    people: [
      { name: "Katharina Brandt", title: "CRO", started: 300, location: "Munich, Germany", mutual: 1, skills: ["Salesforce"] },
    ],
  },
  {
    name: "Kaffeekontor Wien",
    domain: "kaffeekontor.at",
    industry: "Food & Beverage",
    headcount: 150,
    growth: 0.05,
    location: "Vienna, Austria",
    description: "Specialty coffee roaster supplying offices and restaurants.",
    jobs: [
      {
        title: "Erster SDR (m/w/d) – B2B Vertrieb",
        days: 6,
        location: "Wien, Österreich",
        desc: "Du baust unseren B2B-Vertrieb von Grund auf mit auf. Bisher arbeiten wir mit Excel.",
      },
    ],
    people: [
      { name: "Paul Gruber", title: "Geschäftsführer", started: 2000, location: "Vienna, Austria", posts: [{ text: "Wir suchen unseren ersten SDR!", days: 6 }] },
    ],
  },
  {
    name: "Velo Mobility",
    domain: "velo-mobility.de",
    industry: "Mobility",
    headcount: 510,
    growth: 0.11,
    location: "Berlin, Germany",
    description: "E-bike leasing for employers.",
    jobs: [
      { title: "SDR Enterprise UK", days: 4, location: "London, United Kingdom", desc: "Join our first sales team outside Germany." },
      { title: "Account Executive Enterprise UK", days: 10, location: "London, United Kingdom" },
      { title: "Account Executive Mittelstand", days: 70, location: "Berlin, Germany", closed: true },
    ],
    people: [
      { name: "Oliver Grant", title: "Country Manager UK", started: 55, location: "London, United Kingdom", mutual: 0, email: "oliver.grant@velo-mobility.de" },
    ],
  },
  {
    name: "Bergmann Maschinenbau",
    domain: "bergmann-maschinenbau.de",
    industry: "Industrial Machinery",
    headcount: 1600,
    growth: 0.02,
    location: "Nürnberg, Germany",
    description: "Packaging machines for the food industry.",
    jobs: [{ title: "Vertriebsmanager Außendienst Süd (m/w/d)", days: 22, location: "Nürnberg, Germany", desc: "CRM: Microsoft Dynamics 365." }],
    people: [
      {
        name: "Sabine Krüger",
        title: "Vertriebsleiterin",
        started: 74,
        location: "Nürnberg, Germany",
        previous: [{ company: "Krones", title: "Head of Sales DACH", years: "2017–2026", tools: "SAP, Salesforce" }],
      },
    ],
  },
  {
    name: "Alpenblick Hotels",
    domain: "alpenblick-hotels.ch",
    industry: "Hospitality",
    headcount: 4300,
    growth: 0.04,
    location: "Zürich, Switzerland",
    description: "Hotel group with 38 properties in the Alps.",
    jobs: [
      { title: "Sales Development Representative Corporate Partnerships", days: 5, location: "Zürich, Switzerland" },
      { title: "SDR Corporate Partnerships (DACH)", days: 9, location: "Zürich, Switzerland" },
      { title: "Account Executive Partnerships", days: 13, location: "Zürich, Switzerland", desc: "Experience with Salesforce." },
      { title: "Rezeptionist/in", days: 4, location: "Davos, Switzerland" },
    ],
    people: [{ name: "Reto Meier", title: "Director of Sales", started: 900, location: "Zürich, Switzerland" }],
  },
  {
    name: "Pixelfabrik",
    domain: "pixelfabrik.io",
    industry: "Marketing Agency",
    headcount: 65,
    growth: 0.1,
    location: "Köln, Germany",
    description: "Performance marketing agency.",
    jobs: [
      { title: "Account Executive SMB", days: 7, location: "Köln, Germany", desc: "You live in HubSpot every day." },
      { title: "SDR SMB", days: 11, location: "Köln, Germany", desc: "HubSpot Sales Hub" },
    ],
    people: [{ name: "Nina Albrecht", title: "Head of Sales", started: 500, location: "Köln, Germany" }],
  },
  {
    name: "Medicus Digital",
    domain: "medicus-digital.de",
    industry: "Health Tech",
    headcount: 300,
    growth: 0.06,
    location: "Berlin, Germany",
    status: "customer",
    description: "Practice management software for clinics.",
    jobs: [
      { title: "SDR Clinics DACH", days: 8, location: "Berlin, Germany" },
      { title: "Account Executive Clinics DACH", days: 12, location: "Berlin, Germany" },
    ],
    people: [{ name: "Dr. Anna Vogel", title: "Chief Commercial Officer", started: 700, location: "Berlin, Germany" }],
  },
  {
    name: "Finlytics",
    domain: "finlytics.de",
    industry: "Software",
    headcount: 220,
    growth: 0.14,
    location: "Frankfurt, Germany",
    lastOutreach: 5,
    description: "Financial planning software for CFOs.",
    jobs: [
      { title: "SDR Mid-Market", days: 9, location: "Frankfurt, Germany", desc: "Pipedrive" },
      { title: "Account Executive Mid-Market", days: 14, location: "Frankfurt, Germany" },
    ],
    people: [{ name: "Lukas Hartmann", title: "Head of Sales", started: 45, location: "Frankfurt, Germany", mutual: 4 }],
  },
  {
    name: "CloudNest",
    domain: "cloudnest.de",
    industry: "Software",
    headcount: 120,
    growth: 0.03,
    location: "München, Germany",
    status: "open_opportunity",
    description: "Managed Kubernetes for the Mittelstand.",
    jobs: [
      { title: "Founding Account Executive", days: 10, location: "München, Germany", desc: "Be our founding AE and build the sales motion from scratch." },
    ],
    people: [{ name: "Felix Neumann", title: "CEO & Co-Founder", started: 1300, location: "München, Germany" }],
  },
  {
    name: "Fjord Outdoor",
    domain: "fjord-outdoor.no",
    industry: "Apparel & Footwear",
    headcount: 210,
    growth: 0.08,
    location: "Oslo, Norway",
    description: "Outdoor apparel, expanding into German-speaking markets.",
    jobs: [
      { title: "SDR Wholesale DACH", days: 6, location: "Berlin, Germany" },
      { title: "Account Executive Wholesale DACH", days: 9, location: "Berlin, Germany", desc: "Salesforce" },
    ],
    people: [{ name: "Ingrid Solberg", title: "Chief Revenue Officer", started: 600, location: "Oslo, Norway" }],
  },
  {
    name: "Tanne & Co",
    domain: "tanne-co.at",
    industry: "Furniture",
    headcount: 70,
    growth: 0.07,
    location: "Graz, Austria",
    description: "Solid-wood furniture for offices.",
    jobs: [
      { title: "Inside Sales Representative B2B", days: 19, location: "Graz, Austria", desc: "Leads in Excel heute, CRM morgen." },
      { title: "Sales Development Representative B2B", days: 26, location: "Graz, Austria" },
    ],
    people: [],
  },
  {
    name: "Stahlwerk Robotics",
    domain: "stahlwerk-robotics.de",
    industry: "Robotics",
    headcount: 900,
    growth: 0.01,
    location: "Stuttgart, Germany",
    description: "Collaborative robots for welding.",
    jobs: [
      { title: "Key Account Manager Automotive", days: 33, location: "Stuttgart, Germany" },
      { title: "Account Executive Automotive", days: 40, location: "Stuttgart, Germany" },
    ],
    people: [{ name: "Jan Becker", title: "Sales Manager", started: 800, location: "Stuttgart, Germany" }],
  },
  {
    name: "Greenleaf Foods",
    domain: "greenleaf-foods.de",
    industry: "Food & Beverage",
    headcount: 450,
    growth: 0.03,
    location: "Düsseldorf, Germany",
    description: "Plant-based ready meals sold to supermarkets.",
    jobs: [
      { title: "Key Account Manager Retail", days: 24, location: "Düsseldorf, Germany", desc: "Pflege der Kundendaten in Excel." },
      { title: "Junior Key Account Manager Retail", days: 30, location: "Düsseldorf, Germany" },
      { title: "Promoter (m/w/d) Verkostung", days: 5, location: "Köln, Germany" },
    ],
    people: [{ name: "Miriam Schulz", title: "Head of Key Account Management", started: 1000, location: "Düsseldorf, Germany" }],
  },
  {
    name: "Quantum Leap Software",
    domain: "quantumleap.de",
    industry: "Software",
    headcount: 2500,
    growth: -0.04,
    location: "Berlin, Germany",
    description: "ERP software.",
    jobs: [
      { title: "Call Center Agent (m/w/d)", days: 4, location: "Leipzig, Germany" },
      { title: "Kundenservice Mitarbeiter Callcenter", days: 6, location: "Leipzig, Germany" },
    ],
    people: [],
  },
  {
    name: "Helix Bio",
    domain: "helix-bio.ch",
    industry: "Biotech",
    headcount: 600,
    growth: 0.05,
    location: "Basel, Switzerland",
    description: "Lab automation for biotech research.",
    jobs: [
      { title: "Customer Success Manager", days: 7, location: "Basel, Switzerland" },
      { title: "Onboarding Manager", days: 12, location: "Basel, Switzerland" },
    ],
    people: [],
  },
  {
    name: "Kiezkantine",
    domain: "kiezkantine.de",
    industry: "Food & Beverage",
    headcount: 55,
    growth: 0.25,
    location: "Berlin, Germany",
    funding: 40,
    description: "Office catering platform.",
    jobs: [{ title: "Founding Sales Team: Account Executive", days: 8, location: "Berlin, Germany", desc: "Join the founding team and build sales from scratch." }],
    people: [{ name: "Aylin Demir", title: "Co-Founder & CEO", started: 900, location: "Berlin, Germany", posts: [{ text: "We are hiring our founding AE!", days: 8 }] }],
  },
  {
    name: "Wolkenwerk",
    domain: "wolkenwerk.de",
    industry: "Software",
    headcount: 140,
    growth: 0.04,
    location: "Leipzig, Germany",
    exported: true,
    description: "Cloud backup for small businesses.",
    jobs: [
      { title: "SDR SMB", days: 28, location: "Leipzig, Germany" },
      { title: "SDR SMB (Englisch)", days: 36, location: "Leipzig, Germany" },
    ],
    people: [{ name: "Tobias Fischer", title: "Teamlead Sales SMB", started: 650, location: "Leipzig, Germany", email: "tobias.fischer@wolkenwerk.de" }],
  },
  {
    name: "Rheinmetrik",
    domain: "rheinmetrik.de",
    industry: "Engineering",
    headcount: 180,
    growth: 0,
    location: "Bonn, Germany",
    description: "Measurement services.",
    jobs: [
      { title: "Account Executive", days: 52, location: "Bonn, Germany" },
      { title: "SDR", days: 58, location: "Bonn, Germany" },
    ],
    people: [],
  },
  {
    name: "Brightwave Energy",
    domain: "brightwave.energy",
    industry: "Renewable Energy",
    headcount: 1150,
    growth: 0.08,
    location: "München, Germany",
    description: "Battery storage for commercial buildings.",
    jobs: [
      { title: "Account Executive Enterprise DACH", days: 11, location: "München, Germany", desc: "Microsoft Dynamics" },
      { title: "Senior Account Executive Enterprise", days: 17, location: "München, Germany" },
      { title: "Account Executive Enterprise (Schweiz)", days: 23, location: "Zürich, Switzerland" },
    ],
    people: [{ name: "Daniel Roth", title: "Head of Enterprise Sales", started: 450, location: "München, Germany", mutual: 7 }],
  },
];

const slugOf = (c: CompanySpec) => c.domain.split(".")[0];

function mkJob(spec: JobSpec, company: CompanySpec, settings: Settings, now: Date, i: number): Job {
  const country = countryFromLocation(spec.location ?? company.location);
  const posted = ago(spec.days, now, 8 + (i % 8));
  return {
    id: `job_${slugOf(company)}_${i}`,
    source: "linkedin",
    externalId: `demo-${company.domain}-${i}`,
    title: spec.title,
    url: `https://www.linkedin.com/jobs/view/${4100000000 + i * 7919 + company.name.length * 104729}`,
    location: spec.location ?? company.location,
    country,
    city: cityFromLocation(spec.location ?? company.location),
    description: spec.desc ?? null,
    employerName: company.name,
    postedAt: posted,
    firstSeenAt: posted,
    lastSeenAt: now.toISOString(),
    closedAt: spec.closed ? ago(Math.max(0, spec.days - 30), now) : null,
    fromScan: false,
    cls: classifyJobByRules({ title: spec.title, description: spec.desc, location: spec.location, country, employerName: company.name }, settings.exclusions),
  };
}

function mkPerson(spec: PersonSpec, company: CompanySpec, now: Date, i: number): Person {
  const [firstName, ...rest] = spec.name.replace(/^Dr\. /, "").split(" ");
  const slug = spec.name.toLowerCase().replace(/^dr\. /, "").replace(/[^a-z]+/g, "-");
  const previousRoles = (spec.previous ?? []).map((p) => {
    const [from, to] = p.years.split("–");
    return { company: p.company, title: p.title, from: from ? `${from}-01-01` : null, to: to ? `${to}-01-01` : null };
  });
  return {
    id: `per_${slugOf(company)}_${i}`,
    name: spec.name,
    firstName,
    lastName: rest.join(" "),
    title: spec.title,
    linkedinUrl: `https://www.linkedin.com/in/${slug}`,
    email: spec.email ?? null,
    location: spec.location ?? company.location,
    country: countryFromLocation(spec.location ?? company.location),
    roleStartedAt: spec.started === null ? null : ago(spec.started, now),
    previousRoles,
    schools: spec.schools ?? [],
    posts: (spec.posts ?? []).map((p) => ({ text: p.text, at: ago(p.days, now), url: `https://www.linkedin.com/feed/update/urn:li:activity:${7300000000000000000 + p.days}` })),
    mutualConnections: spec.mutual ?? null,
    sharedHistory: spec.shared ?? null,
    source: "demo",
    scrapedAt: ago(1, now),
    cls: classifyPersonByRules({
      title: spec.title,
      location: spec.location,
      skills: spec.skills,
      previousRoles: (spec.previous ?? []).map((p) => ({ company: p.company, title: p.title, description: p.tools ?? null })),
    }),
  };
}

export function buildDemoCompanies(orgId: string, settings: Settings, now = new Date()): Company[] {
  return SPECS.map((spec, idx) => {
    const created = ago(30 + idx, now);
    const country = countryFromLocation(spec.location);
    const owner = spec.owner ? DEMO_TEAM.find((m) => m.id === spec.owner) : null;
    const base: Company = {
      // Deterministic ids: the in-memory demo store is rebuilt per server instance, links must still work.
      id: `co_${orgId.replace(/^o_/, "")}_${slugOf(spec)}`,
      orgId,
      name: spec.name,
      domain: spec.domain,
      linkedinUrl: `https://www.linkedin.com/company/${spec.domain.split(".")[0]}`,
      linkedinId: String(10000000 + idx * 37),
      logoUrl: null,
      industry: spec.industry,
      headcount: spec.headcount,
      headcountGrowth6m: spec.growth ?? null,
      country,
      city: cityFromLocation(spec.location),
      fundingAt: spec.funding ? ago(spec.funding, now) : null,
      description: spec.description,
      status: spec.status ?? "prospect",
      routedTo: null,
      divisions: [],
      jobs: spec.jobs.map((j, i) => mkJob(j, spec, settings, now, idx * 20 + i)),
      people: spec.people.map((p, i) => mkPerson(p, spec, now, i)),
      clusters: [],
      score: null,
      scoreHistory: [],
      owner: owner ? { userId: owner.id, name: owner.name, claimedAt: ago(3, now) } : null,
      lastOutreachAt: spec.lastOutreach !== undefined ? ago(spec.lastOutreach, now) : null,
      crm: { detected: null, exportedAt: spec.exported ? ago(10, now) : null, hubspotCompanyId: null, hubspotContactIds: {} },
      sources: [{ kind: "demo", at: created }],
      enrichedAt: ago(1, now),
      createdAt: created,
      updatedAt: now.toISOString(),
    };
    const { company } = recompute(base, settings, now);
    // A plausible score history: climbing towards today's priority over 30 days.
    const p = company.score!.priority;
    const history = Array.from({ length: 30 }, (_, i) => {
      const d = 29 - i;
      const v = Math.max(5, Math.round(p - (d / 29) * (p * (idx % 3 === 0 ? 0.45 : 0.2)) + ((idx + i) % 4) - 2));
      const priority = d === 0 ? p : Math.min(100, v);
      return { at: ago(d, now, 6), priority, tier: priority >= settings.hotThreshold ? ("hot" as const) : priority >= settings.warmThreshold ? ("warm" as const) : ("cold" as const) };
    });
    return { ...company, scoreHistory: history };
  });
}

function demoSignals(companies: Company[], now: Date): Signal[] {
  const out: Signal[] = [];
  companies.forEach((c, i) => {
    const dm = c.people.find((p) => p.id === c.score?.decisionMakerId);
    c.clusters.forEach((cl) => {
      out.push({
        id: newId("sig"),
        companyId: c.id,
        companyName: c.name,
        type: "hiring_cluster",
        title: `New hiring cluster: ${cl.openRoles} open roles in ${cl.label}`,
        strength: cl.index,
        at: cl.firstSeenAt,
        payload: { clusterKey: cl.key },
      });
    });
    for (const p of c.people.filter((x) => x.cls.roleFamily === "leader" && x.roleStartedAt && Date.parse(x.roleStartedAt) > now.getTime() - 90 * DAY)) {
      out.push({ id: newId("sig"), companyId: c.id, companyName: c.name, type: "new_sales_leader", title: `New sales leader: ${p.name} (${p.title})`, strength: 80, at: ago(1 + (i % 5), now, 10), payload: { personId: p.id } });
    }
    if (c.score && c.score.tier !== "cold" && i < 6) {
      out.push({
        id: newId("sig"),
        companyId: c.id,
        companyName: c.name,
        type: "tier_changed",
        title: c.score.tier === "hot" ? "Warm → Hot" : "Cold → Warm",
        strength: c.score.priority,
        at: new Date(now.getTime() - (i + 1) * 47 * 60_000).toISOString(),
        payload: { from: c.score.tier === "hot" ? "warm" : "cold", to: c.score.tier, person: dm?.name ?? null },
      });
    }
  });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function demoOutreach(orgId: string, companies: Company[], now: Date): OutreachEvent[] {
  const events: OutreachEvent[] = [];
  const angles: Angle[] = ["first_90_days", "team_buildout", "crm_displacement", "expansion"];
  const flow: OutreachType[] = ["connection_sent", "accepted", "message_sent", "replied", "meeting_booked"];
  // Older outreach on fictional past accounts, so analytics have history without suppressing today's list.
  const pastAccounts = ["Hafenblick Media", "Spreewald Tech", "Löwenzahn Health", "Mainhattan Capital", "Elbtal Software", "Ostsee Travel", "Bodensee Labs", "Kranich Systems", "Zugspitze Apps", "Harz Logistics", "Moselwein Digital", "Taunus Analytics"];
  pastAccounts.forEach((name, i) => {
    const member = DEMO_TEAM[i % DEMO_TEAM.length];
    const angle = angles[i % angles.length];
    const depth = [5, 3, 4, 2, 5, 1, 3, 4, 2, 3, 5, 2][i];
    const start = 20 + i * 3;
    for (let s = 0; s < depth; s++) {
      events.push({
        id: newId("out"),
        orgId,
        companyId: `past_${i}`,
        companyName: name,
        personId: null,
        personName: ["Anna", "Ben", "Carla", "David", "Eva", "Finn"][i % 6] + " " + ["Wolf", "Koch", "Lang", "Beck"][i % 4],
        userId: member.id,
        userName: member.name,
        type: flow[s],
        angle,
        note: null,
        at: ago(Math.max(15, start - s * 2), now, 8 + ((i * 3 + s * 5) % 10)),
      });
    }
    if (depth === 3 && i % 2 === 0)
      events.push({ ...events.at(-1)!, id: newId("out"), type: "not_interested", at: ago(Math.max(15, start - 8), now, 14) });
  });
  const finlytics = companies.find((c) => c.name === "Finlytics");
  if (finlytics) {
    const dm = finlytics.people[0];
    events.push(
      { id: newId("out"), orgId, companyId: finlytics.id, companyName: finlytics.name, personId: dm?.id ?? null, personName: dm?.name ?? null, userId: "u_demo_lea", userName: "Lea Schmidt", type: "connection_sent", angle: "first_90_days", note: null, at: ago(6, now, 9) },
      { id: newId("out"), orgId, companyId: finlytics.id, companyName: finlytics.name, personId: dm?.id ?? null, personName: dm?.name ?? null, userId: "u_demo_lea", userName: "Lea Schmidt", type: "accepted", angle: "first_90_days", note: null, at: ago(5, now, 16) },
    );
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

/** Loads the demo accounts, team, outreach history and templates into a workspace. */
export async function seedDemo(store: Store, orgId: string, opts: { withTeam?: boolean } = {}): Promise<number> {
  const now = new Date();
  const settings = await store.getSettings(orgId);
  if (opts.withTeam) {
    for (const m of DEMO_TEAM) {
      if (m.id === DEMO_USER_ID) continue;
      if (!(await store.getUser(m.id))) {
        const u: User = { id: m.id, email: m.email, name: m.name, image: null, defaultOrgId: orgId, createdAt: ago(60, now) };
        await store.putUser(u);
      }
      await store.setMember(orgId, m.id, { role: m.role, status: "active", joinedAt: ago(50, now) });
    }
  }
  const companies = buildDemoCompanies(orgId, settings, now);
  const reseed = (await store.getCompany(companies[0].id)) !== null;
  for (const c of companies) {
    await store.putCompany(c);
    if (c.linkedinUrl) await store.setCompanyKey(orgId, c.linkedinUrl, c.id);
    if (c.domain) await store.setCompanyKey(orgId, c.domain, c.id);
  }
  if ((await store.getTemplates(orgId)).length === 0) await store.putTemplates(orgId, defaultTemplates());
  // Loading the demo twice refreshes the accounts but does not duplicate the history.
  if (reseed) return companies.length;
  await store.addSignals(orgId, demoSignals(companies, now).reverse());
  const count = (b: string) => companies.filter((c) => c.score?.bucket === b).length;
  await store.putKpiSnapshot(orgId, new Date(now.getTime() - 7 * DAY).toISOString().slice(0, 10), {
    call_today: Math.max(0, count("call_today") - 3),
    net_new: count("net_new") + 1,
    changed_24h: 2,
    new_leader: 3,
    routed: Math.max(0, count("routed") - 1),
  });
  for (const e of demoOutreach(orgId, companies, now).reverse()) await store.addOutreach(e);

  const laufwerk = companies[0];
  const research: Research[] = [
    {
      id: newId("res"),
      orgId,
      requestedBy: DEMO_USER_ID,
      url: "https://www.linkedin.com/in/jonas-weber",
      kind: "person",
      status: "done",
      error: null,
      runIds: ["demo-run-1", "demo-run-2", "demo-run-3"],
      costUsd: 0.042,
      companyId: laufwerk.id,
      personId: laufwerk.people[0]?.id ?? null,
      simulated: true,
      context: {},
      createdAt: ago(1, now, 8),
      updatedAt: ago(1, now, 8),
    },
  ];
  for (const r of research) await store.putResearch(r);
  const scan: Scan = {
    id: newId("scan"),
    orgId,
    searchId: null,
    name: "Sales Development Representative · Germany · 7 days",
    status: "done",
    startedAt: ago(2, now, 6),
    finishedAt: ago(2, now, 6),
    rawJobs: 184,
    companies: 61,
    hits: 9,
    costUsd: 0.37,
    error: null,
    simulated: true,
  };
  await store.putScan(scan);
  return companies.length;
}
