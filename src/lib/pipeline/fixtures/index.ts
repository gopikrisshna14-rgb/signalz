/**
 * Raw actor-shaped fixtures for "Simulate with demo data". Field names deliberately differ between
 * items (as they do between real actors) so the simulation exercises the same mappers.
 */
import { slugToName } from "@/lib/linkedin";

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COMPANIES = ["Nordlicht Commerce", "Isartal Software", "Rheingold Retail Tech", "Alpenrose Foods", "Spreeblick Systems", "Elbe Analytics"];

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function companyForSlug(slug: string): { name: string; slug: string } {
  const name = COMPANIES[hash(slug) % COMPANIES.length];
  return { name, slug: name.toLowerCase().replace(/[^a-z]+/g, "-") };
}

export function profileFixture(personSlug: string, now = new Date()) {
  const name = slugToName(personSlug) || "Alex Example";
  const co = companyForSlug(personSlug);
  const started = new Date(now.getTime() - 35 * DAY);
  return [
    {
      fullName: name,
      headline: "Head of Sales DACH",
      addressWithCountry: "Munich, Bavaria, Germany",
      linkedinUrl: `https://www.linkedin.com/in/${personSlug}`,
      experiences: [
        {
          title: "Head of Sales DACH",
          companyName: co.name,
          companyLinkedinUrl: `https://www.linkedin.com/company/${co.slug}/`,
          caption: `${MONTHS[started.getUTCMonth()]} ${started.getUTCFullYear()} - Present · 1 mo`,
          startDate: { year: started.getUTCFullYear(), month: started.getUTCMonth() + 1, day: started.getUTCDate() },
        },
        { title: "Sales Director E-Commerce", companyName: "Shopfabrik GmbH", caption: "Jan 2020 - Aug 2026 · 6 yrs 8 mos", description: "Rolled out HubSpot Sales Hub for a team of 14 reps." },
        { title: "Account Executive", subtitle: "Cloudwerk AG", caption: "Mar 2016 - Dec 2019" },
      ],
      skills: [{ title: "HubSpot" }, { title: "Sales Leadership" }, { title: "B2B SaaS" }],
      educations: [{ schoolName: "LMU München" }],
      about: "Building sales teams that sell to e-commerce brands.",
    },
  ];
}

export function postsFixture(personSlug: string, now = new Date()) {
  return [
    { text: "Five weeks in: we are building our e-commerce sales team in DACH. Hiring SDRs and AEs!", postedAt: new Date(now.getTime() - 4 * DAY).toISOString(), url: `https://www.linkedin.com/feed/update/urn:li:activity:${hash(personSlug)}1` },
    { text: "What tools helped your new reps ramp fastest?", date: "2 weeks ago" },
  ];
}

export function companyFixture(companySlug: string) {
  const known = COMPANIES.find((c) => c.toLowerCase().replace(/[^a-z]+/g, "-") === companySlug);
  const name = known ?? (slugToName(companySlug) || "Example GmbH");
  return [
    {
      companyName: name,
      linkedinUrl: `https://www.linkedin.com/company/${companySlug}`,
      website: `https://www.${companySlug.replace(/-/g, "")}.de`,
      companyId: String(80000000 + (hash(companySlug) % 9999999)),
      industry: "Software Development",
      employeeCount: "201-500",
      headcountGrowth6m: "14%",
      headquarter: { city: "Munich", country: "DE" },
      description: `${name} builds software for online retailers.`,
    },
  ];
}

export function employeesFixture(companySlug: string, now = new Date()) {
  const started = new Date(now.getTime() - 28 * DAY);
  return [
    {
      name: "Miriam Kessler",
      jobTitle: "VP Sales DACH",
      location: "Munich, Germany",
      profileUrl: `https://www.linkedin.com/in/miriam-kessler-${companySlug}`,
      positions: [{ title: "VP Sales DACH", company: slugToName(companySlug), startDate: started.toISOString().slice(0, 10) }, { title: "Head of Sales", company: "Pipeline Pro", startDate: "2019-04", endDate: "2026-08", description: "Salesforce" }],
    },
    { name: "Daniel Vogt", jobTitle: "Revenue Operations Manager", location: "Munich, Germany", profileUrl: `https://www.linkedin.com/in/daniel-vogt-${companySlug}` },
  ];
}

export function jobsFixture(companyName: string, companySlug: string, now = new Date()) {
  const ago = (d: number) => now.getTime() - d * DAY;
  const base = `https://www.linkedin.com/jobs/view/`;
  const h = hash(companySlug);
  return [
    { id: `${h}01`, title: "SDR E-Commerce DACH (m/w/d)", companyName, location: "Munich, Bavaria, Germany", postedAt: "3 days ago", jobUrl: `${base}${h}01`, descriptionText: "Help us build the e-commerce sales team. Our CRM today is Salesforce." },
    { jobId: `${h}02`, jobTitle: "Business Development Representative E-Commerce", company: companyName, jobLocation: "Berlin, Germany", publishedAt: "vor 5 Tagen", link: `${base}${h}02` },
    { id: `${h}03`, positionName: "Account Executive E-Commerce DACH", companyName, location: "Munich, Germany", postedTime: Math.floor(ago(8) / 1000), url: `${base}${h}03` },
    { id: `${h}04`, title: "Head of E-Commerce Sales DACH", companyName, location: "Munich, Germany", listedAt: ago(12), description: "Build the team from scratch." },
    { id: `${h}05`, title: "Kassierer (m/w/d) Filiale München", companyName, location: "München, Germany", postedAt: "2 days ago" },
    { id: `${h}06`, title: "Customer Success Manager", companyName, location: "Munich, Germany", postedDate: new Date(ago(20)).toISOString().slice(0, 10) },
  ];
}

/** A market-scan result: several employers, one recruiter posting, one store job. */
export function scanFixture(now = new Date()) {
  const d = (n: number) => new Date(now.getTime() - n * DAY).toISOString();
  return [
    { id: "scan-1", title: "Sales Development Representative (m/w/d)", companyName: "Bergwerk Outdoor", companyUrl: "https://www.linkedin.com/company/bergwerk-outdoor", location: "Munich, Germany", postedAt: d(2) },
    { id: "scan-2", title: "SDR DACH", companyName: "Bergwerk Outdoor", companyUrl: "https://www.linkedin.com/company/bergwerk-outdoor", location: "Munich, Germany", postedAt: d(4), description: "We work in Pipedrive today." },
    { id: "scan-3", title: "Founding Account Executive", companyName: "Lumenfeld AI", companyUrl: "https://www.linkedin.com/company/lumenfeld-ai", location: "Berlin, Germany", postedAt: d(1), description: "Build our sales motion from scratch." },
    { id: "scan-4", title: "Sales Development Representative", companyName: "Hays", location: "Frankfurt, Germany", postedAt: d(3), description: "Für unseren Kunden suchen wir einen SDR." },
    { id: "scan-5", title: "Sales Associate, Store Hamburg", companyName: "Bergwerk Outdoor", companyUrl: "https://www.linkedin.com/company/bergwerk-outdoor", location: "Hamburg, Germany", postedAt: d(2) },
    { id: "scan-6", title: "Head of Sales", companyName: "Kranwerk Logistics", companyUrl: "https://www.linkedin.com/company/kranwerk-logistics", location: "Hamburg, Germany", postedAt: d(6) },
    { id: "scan-7", title: "Account Executive Mid-Market", companyName: "Kranwerk Logistics", companyUrl: "https://www.linkedin.com/company/kranwerk-logistics", location: "Hamburg, Germany", postedAt: d(5) },
    { id: "scan-8", title: "BDR Mid-Market", companyName: "Kranwerk Logistics", companyUrl: "https://www.linkedin.com/company/kranwerk-logistics", location: "Hamburg, Germany", postedAt: d(3), description: "Excel today, CRM tomorrow." },
  ];
}
