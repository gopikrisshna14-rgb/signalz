import type { Metadata } from "next";
import Link from "next/link";
import { ProductShot, SneakerExample } from "./sections";
import { Fraunces } from "next/font/google";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  Handshake,
  MessageSquareQuote,
  Repeat,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";

const display = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { absolute: "Signalz (beta) · Buying signals for SDRs" },
  description:
    "Signalz picks up buying signals from the decision makers you sell to, a new role, a growing team, a new budget, and tells your reps when to reach out and what to say.",
  openGraph: {
    title: "Signalz · Reach buyers when they're ready to buy",
    description: "Buying signals from decision makers, turned into conversations that convert.",
    type: "website",
  },
};

const NAV = [
  { href: "#example", label: "Example" },
  { href: "#signals", label: "Buying signals" },
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#results", label: "Why it converts" },
  { href: "#faq", label: "FAQ" },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-accent">
        <span className="size-2.5 rounded-full bg-sun" />
        <span className="absolute inset-1 rounded-full border-2 border-white/40" />
      </span>
      <span className="font-display text-[22px] font-semibold tracking-tight">Signalz</span>
    </span>
  );
}

function Cta({ children = "Join the beta", dark = false }: { children?: React.ReactNode; dark?: boolean }) {
  return (
    <Link
      href="/signup"
      className={`group inline-flex h-13 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold transition hover:-translate-y-0.5 ${
        dark ? "bg-[#1d1a14] text-white" : "bg-accent text-accent-fg"
      }`}
    >
      {children}
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Underline({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-full text-sun">
        <path d="M2 8 C 50 2, 120 2, 198 7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold tracking-wide text-accent uppercase">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Hero visual: one decision maker and their buying signals            */
/* ------------------------------------------------------------------ */
function BuyerCard() {
  const signals = [
    { icon: <UserRoundCheck size={16} />, text: "Started as Head of Sales", when: "3 weeks ago" },
    { icon: <Users size={16} />, text: "Is building a team of 4 new reps", when: "this month" },
    { icon: <MessageSquareQuote size={16} />, text: "Posted: “Our biggest challenge is onboarding fast”", when: "5 days ago" },
    { icon: <Repeat size={16} />, text: "Used a tool like yours at their last company", when: "2019–2025" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div aria-hidden className="absolute -top-10 -left-10 size-56 rounded-full bg-sun/50 blur-3xl" />
      <div aria-hidden className="absolute -right-10 -bottom-10 size-64 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative rounded-[32px] bg-surface p-6 shadow-[0_40px_80px_-40px_rgba(60,40,0,0.35)] ring-1 ring-line">
        <div className="flex items-center gap-4">
          <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f7c948,#e38b2c)] text-[22px] font-semibold text-white">
            JW
            <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-6 items-center justify-center rounded-full bg-accent ring-4 ring-surface">
              <BadgeCheck size={14} className="text-white" />
            </span>
          </span>
          <div className="min-w-0">
            <div className="font-display text-[22px] leading-tight font-semibold">Jonas Weber</div>
            <div className="text-[14px] text-muted">Head of Sales · Laufwerk Sneakers</div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3">
          <div>
            <div className="text-[12px] font-semibold text-accent uppercase">Ready to talk</div>
            <div className="text-[15px] font-semibold">Reach out this week</div>
          </div>
          <div className="flex items-end gap-1" aria-label="High buying intent">
            {[10, 16, 22, 28].map((h) => (
              <span key={h} className="w-2 rounded-full bg-accent" style={{ height: h }} />
            ))}
          </div>
        </div>

        <div className="mt-5 text-[13px] font-semibold text-muted">Why now</div>
        <ul className="mt-2 space-y-2">
          {signals.map((s) => (
            <li key={s.text} className="flex items-start gap-3 rounded-2xl bg-bg px-3.5 py-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-soft text-sun-ink">{s.icon}</span>
              <div className="min-w-0">
                <div className="text-[14px] leading-snug font-medium">{s.text}</div>
                <div className="text-[12px] text-muted">{s.when}</div>
              </div>
            </li>
          ))}
        </ul>
        <div aria-hidden className="h-28 sm:h-20" />
      </div>

      <div className="absolute -right-3 -bottom-10 w-[82%] rounded-3xl rounded-br-md bg-accent p-4 text-accent-fg shadow-xl sm:-right-12">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold opacity-90">
          <Sparkles size={13} /> Your opener, ready to send
        </div>
        <p className="mt-1.5 text-[14px] leading-snug">
          “Congrats on the new role, Jonas! Saw you’re onboarding 4 reps at once. Happy to share how other sales leaders got new
          hires productive in weeks, not months.”
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  return (
    <div className={`landing ${display.variable} min-h-screen overflow-x-clip`}>
      <style>{`.landing .font-display{font-family:var(--font-display),Georgia,serif}`}</style>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center gap-10 px-5 sm:px-8">
          <Link href="/welcome" aria-label="Signalz home" className="flex items-center gap-2">
            <Logo />
            <span className="rounded-full bg-sun-soft px-2 py-0.5 text-[12px] font-semibold text-sun-ink">Beta</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] text-muted lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-fg">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="hidden h-11 items-center rounded-full px-5 text-[15px] font-semibold hover:bg-surface-2 sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-fg hover:opacity-90">
              Join the beta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-20 px-5 pt-10 pb-28 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:pt-16">
          <div>
            <Kicker>For sales teams that hate cold outreach</Kicker>
            <h1 className="font-display mt-5 text-[44px] leading-[1.02] font-semibold tracking-tight sm:text-[68px]">
              Reach buyers when they’re <Underline>ready</Underline> to buy.
            </h1>
            <p className="mt-7 max-w-xl text-[19px] leading-relaxed text-muted sm:text-[21px]">
              Signalz picks up <b className="font-semibold text-fg">buying signals</b> from the decision makers you sell to, and tells
              you exactly when to reach out and what to say. More replies, more meetings, more closed deals.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Cta>Join the beta</Cta>
              <a href="#how" className="inline-flex h-13 items-center gap-2 px-2 text-[16px] font-semibold underline-offset-4 hover:underline">
                See how it works
              </a>
            </div>
            <div className="mt-10 flex items-center gap-3 text-[14px] text-muted">
              <div className="flex -space-x-2">
                {["#f7c948", "#0f6b4b", "#e38b2c", "#6b8f71"].map((c, i) => (
                  <span key={c} className="inline-flex size-10 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-bg" style={{ background: c }}>
                    {["SDR", "AE", "VP", "BDR"][i]}
                  </span>
                ))}
              </div>
              Built for SDRs, BDRs, AEs and sales leaders
            </div>
          </div>
          <BuyerCard />
        </section>

        <SneakerExample />
        <ProductShot />

        {/* The shift */}
        <section className="bg-surface py-28">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
            <h2 className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight sm:text-[50px]">
              Most deals aren’t lost to competitors. They’re lost to <span className="italic text-accent">bad timing.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-[19px] leading-relaxed text-muted">
              Reach out too early and you’re ignored. Too late and they’ve signed with someone else. Buyers leave clues when they’re
              about to make a decision. Signalz catches them, so your team calls the right person at the right moment.
            </p>
          </div>
        </section>

        {/* Buying signals */}
        <section id="signals" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28 sm:px-8">
          <div className="max-w-2xl">
            <Kicker>Buying signals</Kicker>
            <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">
              The moments that open a buyer’s door
            </h2>
            <p className="mt-5 text-[19px] leading-relaxed text-muted">
              We watch for the changes that make a decision maker open to a conversation, and explain each one in a sentence you can use.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: <UserRoundCheck size={24} />,
                title: "A new decision maker",
                text: "New leaders change things in their first 90 days: tools, partners, processes. Be the first call they get.",
                example: "“Sarah started as VP Sales 3 weeks ago.”",
              },
              {
                icon: <TrendingUp size={24} />,
                title: "A team that’s growing",
                text: "When a company adds people to a team, it needs new tools and support for them. That means budget.",
                example: "“They’re adding 4 people to the sales team.”",
              },
              {
                icon: <MessageSquareQuote size={24} />,
                title: "Talking about the problem",
                text: "What decision makers post and share tells you what’s on their mind, and what your opener should be about.",
                example: "“Posted about slow onboarding last week.”",
              },
              {
                icon: <Repeat size={24} />,
                title: "A familiar face",
                text: "People who used a product like yours before are faster to say yes. We tell you when that’s the case.",
                example: "“Used your category of tool at their last company.”",
              },
            ].map((s) => (
              <div key={s.title} className="flex flex-col rounded-[28px] bg-surface p-8 ring-1 ring-line">
                <span className="inline-flex size-13 items-center justify-center rounded-2xl bg-sun-soft text-sun-ink">{s.icon}</span>
                <h3 className="font-display mt-6 text-[26px] leading-tight font-semibold">{s.title}</h3>
                <p className="mt-3 text-[17px] leading-relaxed text-muted">{s.text}</p>
                <div className="mt-6 rounded-2xl bg-bg px-4 py-3 text-[15px] font-medium italic">{s.example}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-accent text-accent-fg">
          <div className="mx-auto max-w-6xl px-5 py-28 sm:px-8">
            <div className="max-w-2xl">
              <div className="text-[14px] font-semibold tracking-wide uppercase opacity-80">How it works</div>
              <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">
                From signal to meeting in three steps
              </h2>
            </div>
            <ol className="mt-14 grid gap-6 lg:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Tell us who you sell to",
                  text: "Add the companies or people you’re going after, or let Signalz find accounts in your market for you.",
                },
                {
                  n: "02",
                  title: "We catch the signals",
                  text: "Signalz keeps an eye on your buyers and ranks who’s ready right now, with the reason in plain words.",
                },
                {
                  n: "03",
                  title: "You reach out at the right moment",
                  text: "Open your list, pick the top buyer and send a personal opener we’ve already drafted. You stay in control.",
                },
              ].map((s) => (
                <li key={s.n} className="rounded-[28px] bg-white/10 p-8">
                  <div className="font-display text-[44px] leading-none font-semibold text-sun">{s.n}</div>
                  <h3 className="mt-6 text-[22px] font-semibold">{s.title}</h3>
                  <p className="mt-3 text-[17px] leading-relaxed opacity-85">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cold vs signal */}
        <section id="results" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Kicker>Why it converts</Kicker>
            <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">
              Same buyer. Very different message.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-[28px] bg-surface p-8 ring-1 ring-line">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-danger-fg">
                <X size={18} /> The usual cold message
              </div>
              <div className="mt-5 rounded-3xl rounded-bl-md bg-bg p-5 text-[16px] leading-relaxed text-muted">
                “Hi Jonas, hope you’re well! I wanted to reach out because we help companies like yours improve their sales process. Do
                you have 15 minutes next week?”
              </div>
              <ul className="mt-6 space-y-2.5 text-[15px] text-muted">
                {["Could be sent to anyone", "No reason to reply now", "Ends up ignored"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <X size={17} className="mt-0.5 shrink-0 text-danger-fg" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[28px] bg-surface p-8 ring-2 ring-accent">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-accent">
                <Check size={18} /> A message built on signals
              </div>
              <div className="mt-5 rounded-3xl rounded-bl-md bg-accent-soft p-5 text-[16px] leading-relaxed">
                “Congrats on the new role, Jonas! Saw you’re onboarding 4 reps at once, and your post about ramp time. We helped a
                similar team cut it in half. Worth comparing notes?”
              </div>
              <ul className="mt-6 space-y-2.5 text-[15px] font-medium">
                {["Written for this one person", "Arrives while they’re deciding", "Gives a real reason to reply"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check size={17} className="mt-0.5 shrink-0 text-ok" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              { icon: <Target size={22} />, title: "Right person", text: "Talk to the one who decides, not a gatekeeper." },
              { icon: <Clock size={22} />, title: "Right moment", text: "Arrive while the decision is being made." },
              { icon: <Handshake size={22} />, title: "Right message", text: "Open with what they actually care about." },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-4 rounded-[24px] bg-sun-soft p-6">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-sun-ink">{b.icon}</span>
                <div>
                  <h3 className="text-[18px] font-semibold">{b.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="bg-surface py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Kicker>Made for people with a number</Kicker>
              <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">
                Every seller on your team, more effective
              </h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  role: "SDRs & BDRs",
                  quote: "I know who to call first every morning, and what to say.",
                  points: ["A ranked list of ready buyers", "Openers that get replies"],
                },
                {
                  role: "Account Executives",
                  quote: "I walk into first calls already knowing their story.",
                  points: ["What changed and why it matters", "Who signs, and who influences"],
                },
                {
                  role: "Sales leaders",
                  quote: "My team spends its time on buyers who are actually ready.",
                  points: ["Focus on the best accounts", "No two reps chasing the same buyer"],
                },
              ].map((p) => (
                <div key={p.role} className="flex flex-col rounded-[28px] bg-bg p-8">
                  <h3 className="font-display text-[26px] font-semibold">{p.role}</h3>
                  <p className="mt-3 text-[17px] leading-relaxed text-muted italic">{p.quote}</p>
                  <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-[15px] font-medium">
                    {p.points.map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <Check size={17} className="mt-0.5 shrink-0 text-ok" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-[13px] text-muted">Example statements describing the goal for each role.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-28 sm:px-8">
          <div className="text-center">
            <Kicker>FAQ</Kicker>
            <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">Questions, answered</h2>
          </div>
          <div className="mt-12 divide-y divide-line border-y border-line">
            {[
              {
                q: "What is a buying signal?",
                a: "A change that makes a decision maker more likely to buy: they just started a new role, their team is growing, they’re talking publicly about a problem you solve, or they’ve used a product like yours before.",
              },
              {
                q: "Where do the signals come from?",
                a: "From public, professional information such as company pages, LinkedIn profiles and job posts. Signalz brings it together and explains what it means for your deal.",
              },
              {
                q: "Does it contact buyers for me?",
                a: "No. Signalz tells you who to contact and drafts the message. You decide what to send and when, so it always sounds like you.",
              },
              {
                q: "Which markets do you cover?",
                a: "We started with Germany, Austria and Switzerland, and openers can be written in German or English.",
              },
              {
                q: "Can my whole team use it?",
                a: "Yes. Invite your team, share one list of ready buyers, and claim accounts so nobody contacts the same person twice.",
              },
              {
                q: "Is it GDPR friendly?",
                a: "Yes. We only keep professional information, for a limited time, and you can remove any person with one click.",
              },
            ].map((f) => (
              <details key={f.q} className="group py-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[19px] font-semibold">
                  {f.q}
                  <span className="text-[26px] leading-none font-light text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pr-10 text-[17px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-28 sm:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-sun px-6 py-20 text-center text-[#1d1a14] sm:px-12">
            <div aria-hidden className="absolute -top-24 -left-24 size-80 rounded-full bg-white/30" />
            <div aria-hidden className="absolute -right-24 -bottom-32 size-96 rounded-full bg-[#e9b228]/60" />
            <CalendarCheck size={34} className="relative mx-auto" />
            <h2 className="font-display relative mt-5 text-[38px] leading-[1.05] font-semibold tracking-tight sm:text-[60px]">
              Stop chasing. Start converting.
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-[19px] text-[#4a3a10]">
              See which accounts are building a sales team right now. Free during the beta, set up in minutes.
            </p>
            <div className="relative mt-10 flex flex-wrap justify-center gap-4">
              <Cta dark>Join the beta</Cta>
              <Link href="/login" className="inline-flex h-13 items-center rounded-full px-6 text-[16px] font-semibold ring-2 ring-[#1d1a14]/25 hover:bg-white/30">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-10 text-[14px] text-muted sm:flex-row sm:items-center sm:px-8">
          <Logo />
          <nav className="flex flex-wrap gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-fg">
                {n.label}
              </a>
            ))}
            <Link href="/login" className="hover:text-fg">
              Log in
            </Link>
          </nav>
          <span>© {new Date().getFullYear()} Signalz</span>
        </div>
      </footer>
    </div>
  );
}
