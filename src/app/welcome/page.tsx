import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  Coffee,
  Flame,
  Link2,
  MessageCircle,
  Radar,
  Rocket,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Hiring Signals · Know who to call today, and why",
  description:
    "Hiring Signals finds companies that are building their sales team right now and hands you the reason to call, the right person and a message that gets replies.",
  openGraph: {
    title: "Hiring Signals · Your next deal is already hiring",
    description: "Find companies building their sales team right now. Call them first, with a reason they care about.",
    type: "website",
  },
};

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why timing wins" },
  { href: "#who", label: "Who it's for" },
  { href: "#faq", label: "FAQ" },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 text-[16px] font-bold tracking-tight">
      <span className="inline-flex size-8 items-center justify-center rounded-xl bg-accent text-accent-fg">
        <Radar size={17} />
      </span>
      Hiring Signals
    </span>
  );
}

function PrimaryCta({ children = "Get my call list", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <Link
      href="/signup"
      className={`group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[16px] font-semibold text-accent-fg shadow-[0_8px_24px_-8px_var(--accent)] transition hover:-translate-y-0.5 hover:opacity-95 ${className}`}
    >
      {children}
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span aria-hidden className="absolute inset-x-[-4px] bottom-[0.08em] h-[0.42em] -rotate-1 rounded-md bg-sun/70" />
      <span className="relative">{children}</span>
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1 text-[13px] font-semibold text-sun-ink">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero visual: the SDR's morning call list                            */
/* ------------------------------------------------------------------ */
const CALL_LIST = [
  {
    name: "Laufwerk Sneakers",
    who: "Jonas Weber · Head of Sales",
    reason: "New sales boss, 3 weeks in. Hiring 4 reps.",
    icon: <UserPlus size={14} />,
    heat: "Hot",
  },
  {
    name: "Kernwerk AI",
    who: "Founder · CEO",
    reason: "Hiring their first salesperson ever.",
    icon: <Rocket size={14} />,
    heat: "Hot",
  },
  {
    name: "Grünwerk Energie",
    who: "Max Bauer · VP Sales",
    reason: "Hiring 3 SDRs for small-business sales.",
    icon: <Users size={14} />,
    heat: "Warm",
  },
];

function CallListMock() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div aria-hidden className="absolute -top-8 -right-6 size-40 rounded-full bg-sun/40 blur-2xl" />
      <div aria-hidden className="absolute -bottom-10 -left-8 size-48 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative rounded-[28px] border border-line bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] font-medium text-muted">Monday, 8:30</div>
            <div className="text-[18px] font-bold">Your call list today</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-hot-bg px-2.5 py-1 text-[12px] font-bold text-hot-fg">
            <Flame size={13} /> 2 hot
          </span>
        </div>

        <ul className="mt-4 space-y-2.5">
          {CALL_LIST.map((c, i) => (
            <li
              key={c.name}
              className={`rounded-2xl border p-3.5 ${i === 0 ? "border-accent/50 bg-accent-soft/60" : "border-line bg-bg"}`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-[15px] font-bold shadow-sm">
                  {c.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{c.name}</span>
                    <span
                      className={`rounded-full px-2 text-[11px] font-bold ${c.heat === "Hot" ? "bg-hot-bg text-hot-fg" : "bg-warm-bg text-warm-fg"}`}
                    >
                      {c.heat}
                    </span>
                  </div>
                  <div className="truncate text-[12px] text-muted">{c.who}</div>
                </div>
              </div>
              <div className="mt-2.5 flex items-start gap-2 text-[13px] font-medium">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-sun-soft text-sun-ink">
                  {c.icon}
                </span>
                {c.reason}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 pb-24 text-center text-[12px] font-medium text-muted sm:pb-14">+ 9 more accounts on your list</div>
      </div>

      {/* Floating message bubble */}
      <div className="absolute -right-2 -bottom-8 w-[78%] rotate-[1.5deg] rounded-2xl border border-line bg-surface p-3.5 shadow-xl sm:-right-10">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
          <Sparkles size={13} /> Message ready for Jonas
        </div>
        <p className="mt-1 text-[13px] leading-snug">
          “Congrats on the new role! Saw you’re hiring 4 reps for Wholesale at once. How are you planning to get them up to speed?”
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
    <div className="min-h-screen overflow-x-clip bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link href="/welcome" aria-label="Hiring Signals home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-muted lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-fg">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden h-10 items-center rounded-full px-4 text-[14px] font-semibold hover:bg-surface-2 sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-fg hover:opacity-90">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-12 pb-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pt-20">
          <div>
            <Eyebrow>
              <Target size={14} /> For SDRs, BDRs and account executives
            </Eyebrow>
            <h1 className="mt-6 text-[40px] leading-[1.05] font-extrabold tracking-tight sm:text-[60px]">
              Your next deal is <Highlight>already hiring.</Highlight>
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-muted sm:text-[20px]">
              We find companies that are building their sales team <b className="font-semibold text-fg">right now</b>, and hand you
              the reason to call, the right person and a message that gets a reply.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <a
                href="#how"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-6 text-[16px] font-semibold hover:bg-surface-2"
              >
                See how it works
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-medium text-muted">
              {["Free to start", "Ready in 2 minutes", "No LinkedIn login needed"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={16} className="text-ok" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <CallListMock />
        </section>

        {/* Pain */}
        <section className="bg-surface py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <Eyebrow>Sound familiar?</Eyebrow>
              <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">
                Cold outreach is hard when you don’t know <Highlight>why now.</Highlight>
              </h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: <Coffee size={22} />,
                  title: "Hours of research",
                  text: "Ten tabs per account just to find one thing worth saying. By lunch, you’ve called nobody.",
                },
                {
                  icon: <MessageCircle size={22} />,
                  title: "Messages that get ignored",
                  text: "“Hope you’re well, quick question…” Everyone sends it. Nobody answers it.",
                },
                {
                  icon: <Clock size={22} />,
                  title: "Right company, wrong time",
                  text: "You reach them six months too early, or a week after they signed with someone else.",
                },
              ].map((p) => (
                <div key={p.title} className="rounded-3xl bg-bg p-7">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-danger-bg text-danger-fg">{p.icon}</span>
                  <h3 className="mt-5 text-[20px] font-bold">{p.title}</h3>
                  <p className="mt-2 text-[16px] leading-relaxed text-muted">{p.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-[20px] font-semibold sm:text-[24px]">
              The fix isn’t more calls. It’s <span className="text-accent">better timing</span>.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">
              From LinkedIn link to booked meeting
            </h2>
          </div>
          <ol className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              {
                n: "1",
                icon: <Link2 size={22} />,
                title: "Paste a LinkedIn link",
                text: "A person or a company. Or let us scan the market for you.",
                visual: (
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] text-muted">
                    <Search size={15} /> linkedin.com/company/laufwerk
                  </div>
                ),
              },
              {
                n: "2",
                icon: <Sparkles size={22} />,
                title: "We find your reason to call",
                text: "Who is hiring salespeople, who’s the new boss, and how hot the account is.",
                visual: (
                  <div className="space-y-1.5">
                    {["Hiring 4 sales reps", "New Head of Sales, 21 days in", "Uses Salesforce today"].map((r) => (
                      <div key={r} className="flex items-center gap-2 text-[13px] font-medium">
                        <Check size={15} className="text-ok" /> {r}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                n: "3",
                icon: <Send size={22} />,
                title: "Send a message that lands",
                text: "Get a short, personal first message in German or English. You hit send.",
                visual: (
                  <div className="rounded-xl rounded-bl-sm bg-accent px-3 py-2.5 text-[13px] leading-snug text-accent-fg">
                    “Congrats on the new role, Jonas! How are you onboarding the 4 new reps?”
                  </div>
                ),
              },
            ].map((s) => (
              <li key={s.n} className="flex flex-col rounded-3xl border border-line bg-surface p-7">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">{s.icon}</span>
                  <span className="text-[40px] leading-none font-extrabold text-line">{s.n}</span>
                </div>
                <h3 className="mt-5 text-[20px] font-bold">{s.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-muted">{s.text}</p>
                <div className="mt-6 rounded-2xl bg-bg p-4">{s.visual}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* Why timing wins */}
        <section id="why" className="scroll-mt-20 bg-accent text-accent-fg">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">
                <TrendingUp size={14} /> Why timing wins
              </div>
              <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">
                A company hiring salespeople is a company about to buy.
              </h2>
              <p className="mt-5 text-[18px] leading-relaxed opacity-90">
                New sales team means new tools, new processes and a new budget. And a new sales leader makes their biggest decisions
                in the first 90 days. We tell you the moment it starts, so you’re the first call, not the fifth.
              </p>
              <p className="mt-5 text-[16px] opacity-90">
                We also filter out the noise: a shop hiring cashiers is not a sales team. You only see the real ones.
              </p>
            </div>

            {/* Timeline */}
            <div className="rounded-3xl bg-white/10 p-6 sm:p-8">
              <div className="text-[14px] font-semibold opacity-90">A new Head of Sales starts</div>
              <ol className="relative mt-6 space-y-6 border-l-2 border-white/30 pl-6">
                {[
                  { day: "Day 1", text: "Starts the job, looks at what’s broken", tag: null },
                  { day: "Day 21", text: "Posts 4 sales jobs at once", tag: "We flag it here" },
                  { day: "Day 45", text: "Picks tools and partners for the new team", tag: "Best time to call" },
                  { day: "Day 90", text: "Decisions made. Door closes.", tag: null },
                ].map((t) => (
                  <li key={t.day} className="relative">
                    <span className="absolute top-1 -left-[33px] size-4 rounded-full border-2 border-white bg-accent" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{t.day}</span>
                      {t.tag && <span className="rounded-full bg-sun px-2.5 py-0.5 text-[12px] font-bold text-[#3b2a00]">{t.tag}</span>}
                    </div>
                    <div className="mt-0.5 text-[15px] opacity-90">{t.text}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">Everything you need before you dial</h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Flame size={22} />, title: "A ranked call list", text: "Hot, warm, cold. Start at the top every morning." },
              { icon: <Target size={22} />, title: "The reason to call", text: "One line you can actually use: “new sales boss, hiring 4 reps”." },
              { icon: <UserPlus size={22} />, title: "The right person", text: "Who decides, how long they’ve been there, where they worked before." },
              { icon: <Sparkles size={22} />, title: "A first message, written", text: "Short, personal, no fluff. Edit it or send it as is." },
              { icon: <Users size={22} />, title: "No stepping on toes", text: "Claim an account and your teammates won’t contact it too." },
              { icon: <CalendarCheck size={22} />, title: "What books meetings", text: "See which messages get replies and the best time to send." },
            ].map((f) => (
              <div key={f.title} className="rounded-3xl border border-line bg-surface p-7 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-sun-soft text-sun-ink">{f.icon}</span>
                <h3 className="mt-5 text-[19px] font-bold">{f.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Before / after */}
        <section className="bg-surface py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Your morning</Eyebrow>
              <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">Less digging. More dialing.</h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <div className="rounded-3xl bg-bg p-7">
                <div className="flex items-center gap-2 text-[15px] font-bold text-muted">
                  <X size={18} className="text-danger-fg" /> Without Hiring Signals
                </div>
                <ul className="mt-5 space-y-3.5 text-[16px] text-muted">
                  {[
                    "Scroll job boards and LinkedIn for an hour",
                    "Guess who the decision maker is",
                    "Write the same opener for everyone",
                    "Find out a colleague already called them",
                  ].map((t) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted/50" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-accent-soft p-7 ring-2 ring-accent/30">
                <div className="flex items-center gap-2 text-[15px] font-bold text-accent">
                  <Check size={18} /> With Hiring Signals
                </div>
                <ul className="mt-5 space-y-3.5 text-[16px] font-medium">
                  {[
                    "Open your list: the hottest accounts are on top",
                    "See who to contact and why, in one line",
                    "Send a message written for that person",
                    "Claimed accounts stay yours",
                  ].map((t) => (
                    <li key={t} className="flex gap-3">
                      <Check size={18} className="mt-0.5 shrink-0 text-ok" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Who it’s for</Eyebrow>
            <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">Made for people with a quota</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                role: "SDRs & BDRs",
                line: "Hit your meeting target without the research grind.",
                points: ["A fresh call list every morning", "Openers that sound like you did your homework"],
              },
              {
                role: "Account Executives",
                line: "Walk into first calls already knowing the story.",
                points: ["Who owns the budget", "What they use today and what’s changing"],
              },
              {
                role: "Sales leaders",
                line: "Point the team at the accounts that matter most.",
                points: ["No double-touches between reps", "See which messages and timing work"],
              },
            ].map((p) => (
              <div key={p.role} className="flex flex-col rounded-3xl border border-line bg-surface p-7">
                <h3 className="text-[22px] font-extrabold">{p.role}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-muted">{p.line}</p>
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
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-surface py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="mt-4 text-[32px] leading-tight font-extrabold tracking-tight sm:text-[44px]">Good questions</h2>
            </div>
            <div className="mt-10 space-y-3">
              {[
                {
                  q: "Where do the insights come from?",
                  a: "From public information: company pages, LinkedIn profiles and job ads. We put it together so you don’t have to.",
                },
                {
                  q: "Does it message people on LinkedIn for me?",
                  a: "No. We write the message and open the profile. You decide what to send, so your account stays safe and it still sounds like you.",
                },
                {
                  q: "Why do companies hiring salespeople make good prospects?",
                  a: "A growing sales team needs tools, training and processes, and a new sales leader usually changes things in their first 90 days. That’s when they’re open to a conversation.",
                },
                {
                  q: "Which markets do you cover?",
                  a: "We started with Germany, Austria and Switzerland (DACH), and messages can be written in German or English.",
                },
                {
                  q: "Can my whole team use it?",
                  a: "Yes. Invite your team, share one list, and claim accounts so nobody calls the same company twice.",
                },
                {
                  q: "Is it GDPR friendly?",
                  a: "Yes. We only keep business information about people, for a limited time, and you can delete anyone with one click.",
                },
              ].map((f) => (
                <details key={f.q} className="group rounded-2xl bg-bg px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                    {f.q}
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-[18px] text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[16px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="relative overflow-hidden rounded-[36px] bg-sun px-6 py-16 text-center sm:px-12">
            <div aria-hidden className="absolute -top-20 -left-16 size-64 rounded-full bg-white/30" />
            <div aria-hidden className="absolute -right-20 -bottom-24 size-72 rounded-full bg-[#f5b400]/50" />
            <h2 className="relative text-[34px] leading-tight font-extrabold tracking-tight text-[#2b2000] sm:text-[52px]">
              Book more meetings this month.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[18px] text-[#4a3800]">
              Create your free account and see your first call list in two minutes.
            </p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1c1917] px-7 text-[16px] font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
              >
                Get my call list <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-full px-6 text-[16px] font-semibold text-[#2b2000] ring-2 ring-[#2b2000]/25 hover:bg-white/30"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-4 py-10 text-[14px] text-muted sm:flex-row sm:items-center sm:px-6">
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
          <span>© {new Date().getFullYear()} Hiring Signals</span>
        </div>
      </footer>
    </div>
  );
}
