"use client";

import { Building2, Database, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NoSeatDialog } from "@/components/no-seat-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type Props =
  | { mode: "start"; autoJoin: { id: string; name: string; full: boolean } | null; domain: string; userName: string }
  | { mode: "demo"; orgName: string; isAdmin: boolean };

const FREEMAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|gmx|web|icloud|proton|protonmail|t-online)\./;

export function Onboarding(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noSeat, setNoSeat] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "no_seat") setNoSeat(data.message);
      else setError(data.message ?? "Something went wrong");
      return null;
    }
    return data;
  }

  if (props.mode === "demo")
    return (
      <div>
        <p className="text-[13px] font-medium text-accent">Workspace created</p>
        <h1 className="mt-1 text-[20px] font-semibold">Start with demo data?</h1>
        <p className="mt-2 text-[14px] text-muted">
          Load 22 sample accounts (a sneaker brand building a wholesale team, and more) to see how Signalz ranks hiring clusters. You can research real
          companies at any time.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {props.isAdmin ? (
            <Button
              variant="primary"
              size="lg"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await call("/api/demo/seed", { method: "POST" });
                  if (r) {
                    toast.success(`Loaded ${r.accounts} demo accounts`);
                    router.push("/");
                    router.refresh();
                  }
                })
              }
            >
              <Database size={16} /> {pending ? "Loading…" : "Load demo data"}
            </Button>
          ) : null}
          <Button size="lg" onClick={() => router.push("/")}>
            Start empty
          </Button>
        </div>
        {error ? <p className="mt-3 text-[13px] text-danger-fg">{error}</p> : null}
      </div>
    );

  const companyDomain = props.domain && !FREEMAIL.test(props.domain) ? props.domain : "";
  return (
    <div>
      <h1 className="text-[20px] font-semibold">Welcome, {props.userName.split(" ")[0]}</h1>
      <p className="mt-1 text-[14px] text-muted">Create a workspace for your team, or join your team’s workspace.</p>

      {props.autoJoin ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <Users size={16} className="text-accent" /> {props.autoJoin.name}
          </div>
          <p className="mt-1 text-[13px] text-muted">Everyone with an @{props.domain} e-mail can join this workspace.</p>
          <Button
            className="mt-3"
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await call("/api/orgs/join", { method: "POST", body: JSON.stringify({ orgId: props.autoJoin!.id }) })) {
                  router.push("/");
                  router.refresh();
                }
              })
            }
          >
            Join {props.autoJoin.name}
          </Button>
        </div>
      ) : null}

      <form
        className="mt-6 space-y-3 rounded-xl border border-line bg-surface p-4"
        action={(form) =>
          start(async () => {
            setError(null);
            const domain = String(form.get("emailDomain") || "").trim();
            const r = await call("/api/orgs", {
              method: "POST",
              body: JSON.stringify({ name: form.get("name"), emailDomain: domain || null, autoJoin: Boolean(domain) && form.get("autoJoin") === "on" }),
            });
            if (r) router.push("/onboarding?step=demo");
          })
        }
      >
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <Building2 size={16} className="text-accent" /> Create a workspace
        </div>
        <Field label="Workspace name" htmlFor="name">
          <Input id="name" name="name" placeholder="e.g. HubSpot SDR DACH" required minLength={2} maxLength={60} />
        </Field>
        <Field label="Company e-mail domain (optional)" htmlFor="emailDomain" hint="Teammates with this domain can join without an invite.">
          <Input id="emailDomain" name="emailDomain" defaultValue={companyDomain} placeholder="company.com" />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="autoJoin" defaultChecked={Boolean(companyDomain)} className="size-4 accent-[var(--accent)]" /> Let them auto-join
        </label>
        {error ? (
          <p role="alert" className="text-[13px] text-danger-fg">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create workspace"}
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted">Got an invite link? Open it while signed in to join that workspace.</p>
      <NoSeatDialog open={noSeat !== null} onOpenChange={(v) => !v && setNoSeat(null)} message={noSeat ?? ""} />
    </div>
  );
}
