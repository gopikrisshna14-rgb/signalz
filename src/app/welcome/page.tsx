import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Database,
  Gauge,
  Link2,
  ListChecks,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Hiring Signals · Find companies building a sales team right now",
  description:
    "Hiring Signals spots companies hiring SDRs, AEs and a new sales leader inside one division, tells you why now, who to contact and what to say.",
  openGraph: {
    title: "Hiring Signals",
    description: "Find companies building a sales team right now, and know exactly why to call them today.",
    type: "website",
  },
};

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#who", label: "Who it's for" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <Radar size={16} />
      </span>
      Hiring Signals
    </span>
  );
}

function Cta({ children = "Get started free", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <Link
      href="/signup"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg shadow-sm transition hover:opacity-90 ${className}`}
    >
      {children} <ArrowRight size={16} />
    </Link>
  );
}

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: React.ReactNode; intro?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-[13px] font-semibold tracking-wide text-accent uppercase">{eyebrow}</div>
      <h2 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight sm:text-[36px]">{title}</h2>
      {intro && <p className="mt-3 text-[16px] text-muted">{intro}</p>}
    </div>
  );
}

/** A static picture of the product: the account card an SDR sees. */
function ProductMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_40%,var(--accent-soft),transparent)]" />
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface-2 font-semibold text-muted">L</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">Laufwerk Sneakers</span>
              <span className="rounded-md bg-hot-bg px-1.5 text-[12px] font-semibold text-hot-fg">Hot</span>
              <span className="rounded-md bg-surface-2 px-1.5 text-[12px] font-medium text-muted">Call today</span>
            </div>
            <div className="text-[13px] text-muted">Footwear · 420 employees · Berlin</div>
          </div>
          <svg width="52" height="52" viewBox="0 0 52 52" aria-label="Priority 84" role="img">
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--surface-2)" strokeWidth="5" />
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--chart-1)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${0.84 * 132} 132`} transform="rotate(-90 26 26)" />
            <text x="26" y="31" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text)">84</text>
          </svg>
        </div>

        <div className="mt-4 rounded-xl bg-surface-2/60 p-3.5">
          <div className="text-[12px] font-semibold tracking-wide text-muted uppercase">Why now</div>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {[
              "4 open roles in Sales · Wholesale · DACH",
              "New Head of Sales, 21 days in the role",
              "Job ads mention Salesforce",
              "Jonas used HubSpot at his last company",
            ].map((r) => (
              <li key={r} className="flex gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-ok" /> {r}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] font-medium text-accent">
            <Clock size={13} /> Buying window closes in ~69 days
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ["Cluster", 95],
            ["Fit", 78],
            ["Timing", 86],
            ["Reach", 70],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="flex justify-between text-[11px] text-muted">
                <span>{l}</span>
                <span className="font-medium text-fg">{v}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <Sparkles size={13} className="text-accent" /> Suggested opener · First 90 days
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed">
            Hi Jonas, congrats on the new role at Laufwerk. Saw you&apos;re hiring 4 people for Wholesale DACH at once. How are you
            planning to onboard them?
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
          <X size={13} className="text-danger-fg" />
          <span>
            Not counted: <span className="line-through">Sales Associate, Store Berlin</span> (shop floor, not B2B sales)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/welcome" aria-label="Hiring Signals home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-5 text-[14px] text-muted md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-fg">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-[14px] font-medium hover:bg-surface-2 sm:inline-flex">
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[14px] font-semibold text-accent-fg hover:opacity-90">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-muted">
              <span className="size-1.5 rounded-full bg-chart-1" /> For SDRs and sales teams in B2B
            </div>
            <h1 className="mt-5 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[52px]">
              Call the companies that are{" "}
              <span className="relative sm:whitespace-nowrap">
                <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded-sm bg-warm-bg sm:h-4" aria-hidden />
                <span className="relative">building a sales team</span>
              </span>{" "}
              right now.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Hiring Signals spots companies hiring SDRs, AEs and a new sales leader inside one division, then tells you{" "}
              <span className="text-fg">why now</span>, <span className="text-fg">who to contact</span> and{" "}
              <span className="text-fg">what to say</span>. Paste a LinkedIn URL. Get a ranked account in minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta />
              <a href="#how" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-[15px] font-medium hover:bg-surface-2">
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-muted">
              {["No credit card", "Set up in a minute", "Built with GDPR in mind"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-ok" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <ProductMock />
        </section>

        {/* Problem */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle
              eyebrow="The problem"
              title="Most “hiring signals” are noise"
              intro="A company posting 30 jobs tells you nothing. A sneaker brand hiring cashiers for its stores is not about to buy a CRM. What matters is where the hiring happens."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-bg p-6">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-danger-fg">
                  <X size={16} /> What other tools show you
                </div>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {[
                    "“Company X is hiring” (but for which team?)",
                    "Store, warehouse and call-center roles mixed in",
                    "A score with no explanation",
                    "Lists you still have to research one by one",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5 text-muted">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/60" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-6">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-accent">
                  <Check size={16} /> What Hiring Signals shows you
                </div>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {[
                    "4 sales roles in one division: Sales · Wholesale · DACH",
                    "Shop-floor and call-center roles filtered out",
                    "Every score explained: “+20 new leader, 21 days in”",
                    "The decision maker, their stack and a first message",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-ok" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="How it works" title="From a LinkedIn URL to a first message in three steps" />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Link2 size={20} />,
                title: "Paste a LinkedIn URL",
                text: "A person or a company, or up to 25 at once. That is all you do.",
              },
              {
                icon: <Search size={20} />,
                title: "We do the research",
                text: "We read the profile, the company and every open job ad, sort each role into its division and drop the ones that don't count.",
              },
              {
                icon: <Target size={20} />,
                title: "You get a ranked account",
                text: "A priority score, the reasons behind it, who to contact, and an opener in their language. Ready to call.",
              },
            ].map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{s.icon}</span>
                  <span className="text-[13px] font-semibold text-muted">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-[18px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>

          {/* What a hiring cluster is */}
          <div className="mt-6 grid items-center gap-8 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-2">
            <div>
              <div className="text-[13px] font-semibold tracking-wide text-accent uppercase">The idea behind it</div>
              <h3 className="mt-2 text-[24px] leading-tight font-semibold tracking-tight">Hiring clusters: the moment a team gets built</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                When a company hires several SDRs and AEs <b className="text-fg">in the same division</b>, often under a{" "}
                <b className="text-fg">new sales leader</b>, it is building a team. New teams need process, tools and onboarding. New
                leaders change tools in their first 90 days. That is when your call lands.
              </p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Sales · Wholesale · DACH", roles: ["SDR", "SDR", "AE", "Head of Sales"], counted: true },
                { label: "Sales · Retail Stores · DACH", roles: ["Sales Associate"], counted: false },
              ].map((d) => (
                <div key={d.label} className={`rounded-xl border p-4 ${d.counted ? "border-accent/40 bg-accent-soft/40" : "border-line bg-bg opacity-80"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{d.label}</span>
                    {d.counted ? (
                      <span className="rounded-md bg-hot-bg px-1.5 text-[12px] font-semibold text-hot-fg">Cluster · 95</span>
                    ) : (
                      <span className="rounded-md bg-surface-2 px-1.5 text-[12px] font-medium text-muted">Not counted</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.roles.map((r, i) => (
                      <span key={i} className={`rounded-md px-2 py-0.5 text-[12px] font-medium ${d.counted ? "bg-surface text-fg" : "bg-surface-2 text-muted line-through"}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="Who it's for" title="Built for the people who start conversations" />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: <Users size={20} />,
                  who: "SDRs & BDRs",
                  text: "Start the day with a shortlist of accounts to call, the reason to call each one and a first message you can send in a minute.",
                  points: ["“Call these first” every morning", "Openers that reference real facts", "One-click outreach logging"],
                },
                {
                  icon: <Target size={20} />,
                  who: "Account Executives",
                  text: "Walk into first calls knowing who owns the budget, what they use today and how the team is changing.",
                  points: ["Decision maker and days in role", "Current CRM from the job ads", "Buying-window countdown"],
                },
                {
                  icon: <BarChart3 size={20} />,
                  who: "Sales leaders & RevOps",
                  text: "Point the team at the accounts that matter, see which angles get replies and keep everyone off each other's accounts.",
                  points: ["Claims stop double-touches", "Reply rate by angle and time", "Adjustable scoring weights"],
                },
              ].map((p) => (
                <div key={p.who} className="flex flex-col rounded-2xl border border-line bg-bg p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">{p.icon}</span>
                  <h3 className="mt-4 text-[18px] font-semibold">{p.who}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.text}</p>
                  <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
                    {p.points.map((t) => (
                      <li key={t} className="flex gap-2">
                        <Check size={15} className="mt-0.5 shrink-0 text-ok" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Features" title="Everything between the signal and the first reply" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Gauge size={18} />, title: "Hiring Cluster Index", text: "0–100 per division: open roles, leader + team mix, new leader, CRM in job ads, velocity." },
              { icon: <ListChecks size={18} />, title: "Explainable scores", text: "Cluster, fit, timing and reach, each with its reasons. Never a number without the why." },
              { icon: <UserCheck size={18} />, title: "Decision-maker context", text: "Days in role, previous companies, tools they used before and what they post about." },
              { icon: <MessageSquareText size={18} />, title: "AI openers", text: "A connection note, first message and e-mail for the angle you pick, in German or English." },
              { icon: <BarChart3 size={18} />, title: "Outreach analytics", text: "Funnel, reply rate by angle, the best time to send and a team leaderboard." },
              { icon: <Database size={18} />, title: "CRM push", text: "Send accounts, contacts and the reasons to HubSpot, Salesforce, Pipedrive or a webhook.", soon: true },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">{f.icon}</span>
                  <h3 className="text-[16px] font-semibold">{f.title}</h3>
                  {f.soon && <span className="ml-auto rounded-md bg-warm-bg px-1.5 text-[11px] font-semibold text-warm-fg">Soon</span>}
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold">You stay in control on LinkedIn</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">
                Hiring Signals never logs into your LinkedIn account and never sends messages for you. It writes the draft, opens the
                profile, and you hit send. We store only business information about people, and keep it for a limited time.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="FAQ" title="Questions people ask" />
            <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-bg">
              {[
                {
                  q: "Where does the data come from?",
                  a: "From public sources: LinkedIn company and profile pages and the company's job ads. You paste the URL, we research it and keep the source and date on every profile.",
                },
                {
                  q: "What exactly is a “hiring cluster”?",
                  a: "Two or more open sales roles in the same division (function + business unit + region) within 45 days, or a sales leader in their first 90 days plus at least one open role. Roles in different divisions never add up, and store or call-center roles never count.",
                },
                {
                  q: "Does it send messages on LinkedIn for me?",
                  a: "No. It drafts the message and opens the profile. You send it yourself and log it with one click, so you stay within LinkedIn's rules.",
                },
                {
                  q: "Which CRMs does it work with?",
                  a: "The CRM push for HubSpot, Salesforce, Pipedrive and custom webhooks is on the way. Until then you can work fully inside Hiring Signals.",
                },
                {
                  q: "Is it GDPR compliant?",
                  a: "It is built with GDPR in mind: only business-context data, limited retention, a delete button for people, and openers that can say where the data came from.",
                },
                {
                  q: "Can my whole team use it?",
                  a: "Yes. Create a workspace and invite teammates. Everyone sees the same accounts, and claims make sure two SDRs never contact the same company.",
                },
              ].map((f) => (
                <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                    {f.q}
                    <span className="text-[20px] leading-none text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-accent px-6 py-14 text-center text-accent-fg sm:px-12">
            <div className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10" aria-hidden />
            <div className="absolute -bottom-28 -left-16 size-72 rounded-full bg-white/10" aria-hidden />
            <h2 className="relative text-[28px] leading-tight font-semibold tracking-tight sm:text-[38px]">
              Stop guessing who to call next.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-[16px] opacity-90">
              Create your workspace in a minute, load the demo accounts and see your first “Call today” list.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface px-5 text-[15px] font-semibold text-fg shadow-sm hover:opacity-90"
              >
                Get started free <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex h-11 items-center rounded-xl px-5 text-[15px] font-medium ring-1 ring-current/40 hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <nav className="flex flex-wrap gap-5">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-fg">
                {n.label}
              </a>
            ))}
            <Link href="/login" className="hover:text-fg">
              Sign in
            </Link>
          </nav>
          <span>© {new Date().getFullYear()} Hiring Signals</span>
        </div>
      </footer>
    </div>
  );
}
