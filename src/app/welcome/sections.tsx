import { ArrowRight, Briefcase, Check, Crown, Sparkles, X } from "lucide-react";
import { TierPill } from "@/components/ui/pills";
import { buildDemoCompanies } from "@/lib/demo";
import { defaultSettings } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* The sneaker brand, in three steps                                   */
/* ------------------------------------------------------------------ */
export function SneakerExample() {
  const roles = [
    { t: "SDR Wholesale DACH", ok: true },
    { t: "Sales Development Rep Wholesale DACH", ok: true },
    { t: "Account Executive Wholesale DACH", ok: true },
    { t: "Sales Team Lead Wholesale DACH", ok: true },
    { t: "Sales Associate, Store Berlin", ok: false },
  ];
  return (
    <section id="example" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-28 sm:px-8">
      <div className="max-w-2xl">
        <div className="text-[14px] font-semibold tracking-wide text-accent uppercase">One example</div>
        <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">A sneaker brand builds a wholesale team</h2>
        <p className="mt-5 text-[19px] leading-relaxed text-muted">
          You sell a CRM. Signalz spots a company hiring a whole sales team inside one division, and ignores the roles that don’t matter.
        </p>
      </div>
      <ol className="mt-14 grid gap-6 lg:grid-cols-3">
        <li className="rounded-[28px] bg-surface p-7 ring-1 ring-line">
          <Step n="1" icon={<Briefcase size={18} />} title="Four roles, one division" />
          <p className="mt-2 text-[15px] text-muted">Sales · Wholesale · DACH, all posted in the last 3 weeks.</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            {roles.map((r) => (
              <li key={r.t} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${r.ok ? "bg-accent-soft" : "bg-bg text-muted"}`}>
                {r.ok ? <Check size={16} className="mt-0.5 shrink-0 text-ok" /> : <X size={16} className="mt-0.5 shrink-0 text-danger-fg" />}
                <span className={r.ok ? "" : "line-through"}>{r.t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">The store job is shop-floor staff in another division: not counted.</p>
        </li>
        <li className="rounded-[28px] bg-surface p-7 ring-1 ring-line">
          <Step n="2" icon={<Crown size={18} />} title="A new leader with budget" />
          <p className="mt-2 text-[15px] text-muted">The context that makes this the right week to reach out.</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            {[
              "Jonas Weber started as Head of Sales 3 weeks ago",
              "Job ads mention Salesforce: a CRM decision is open",
              "Headcount +18 % in 6 months",
              "Jonas used HubSpot at the last company",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 rounded-xl bg-bg px-3 py-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </li>
        <li className="rounded-[28px] bg-accent p-7 text-accent-fg">
          <Step n="3" icon={<Sparkles size={18} />} title="#1 on today’s list" light />
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Laufwerk Sneakers</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[12px] font-semibold">Hot · Call today</span>
            </div>
            <p className="mt-2 text-[14px] opacity-90">4 open roles in Sales · Wholesale · DACH (3 SDR/AE, 1 leader)</p>
          </div>
          <p className="mt-4 rounded-2xl rounded-bl-md bg-white p-4 text-[14px] leading-relaxed text-[#1d1a14]">
            “Hi Jonas, congrats on the new role. With four open roles in your new wholesale team in DACH, the next weeks decide how the team prospects and
            reports. How are you planning to onboard the new reps?”
          </p>
          <p className="mt-3 text-[13px] opacity-85">You copy it, open LinkedIn, send it yourself, and log it with one click.</p>
        </li>
      </ol>
    </section>
  );
}

function Step({ n, icon, title, light }: { n: string; icon: React.ReactNode; title: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex size-9 items-center justify-center rounded-full text-[15px] font-semibold ${light ? "bg-sun text-[#1d1a14]" : "bg-sun-soft text-sun-ink"}`}>{n}</span>
      <span className={light ? "opacity-90" : "text-accent"}>{icon}</span>
      <h3 className="text-[19px] font-semibold">{title}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product shot rendered from the demo data                            */
/* ------------------------------------------------------------------ */
export function ProductShot() {
  const companies = buildDemoCompanies("landing", defaultSettings())
    .filter((c) => c.score && c.score.bucket === "call_today")
    .sort((a, b) => b.score!.priority - a.score!.priority)
    .slice(0, 5);
  return (
    <section id="product" className="scroll-mt-20 bg-surface py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <div className="text-[14px] font-semibold tracking-wide text-accent uppercase">The product</div>
          <h2 className="font-display mt-4 text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">Your morning list, ranked</h2>
          <p className="mt-5 text-[19px] leading-relaxed text-muted">Every score shows why: hiring cluster, ICP fit, timing and how reachable the buyer is.</p>
        </div>
        <div className="mt-12 overflow-hidden rounded-[24px] bg-[#0b0b0d] p-2 ring-1 ring-line sm:p-3" aria-label="Screenshot of the Today dashboard with demo data" role="img">
          <div className="overflow-x-auto rounded-[18px] bg-white text-[#18181b]">
            <div className="flex items-center gap-2 border-b border-[#e4e4e7] px-4 py-3 text-[13px]">
              <span className="font-semibold">Hiring signals</span>
              <span className="text-[#71717a]">last 45 days · {companies.length} in Call today</span>
            </div>
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[12px] text-[#71717a]">
                <tr>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Division</th>
                  <th className="px-4 py-2 font-medium">Cluster</th>
                  <th className="px-4 py-2 font-medium">Fit</th>
                  <th className="px-4 py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-[#f0f0f2]">
                    <td className="px-4 py-2.5">
                      <TierPill tier={c.score!.tier} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{c.name}</div>
                      <div className="max-w-[260px] truncate text-[12px] text-[#71717a]">{c.score!.reasons[0]}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#3f3f46]">{c.clusters[0]?.label}</td>
                    <td className="tabular px-4 py-2.5">{c.score!.cluster}</td>
                    <td className="tabular px-4 py-2.5">{c.score!.fit}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="tabular w-6 font-semibold">{c.score!.priority}</span>
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#f4f4f5]">
                          <span className="block h-full rounded-full bg-[#047857]" style={{ width: `${c.score!.priority}%` }} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <a href="/signup" className="mt-8 inline-flex items-center gap-2 text-[16px] font-semibold text-accent underline-offset-4 hover:underline">
          Join the beta and try it with demo data <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}
