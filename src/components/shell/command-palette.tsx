"use client";

import { Command } from "cmdk";
import { Building2, Crosshair, LayoutDashboard, Moon, Settings } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResearchDialog } from "@/components/research/research-dialog";
import { toggleTheme } from "@/components/theme-toggle";
import { BUCKET_LABEL, type Bucket } from "@/lib/types";
import { NAV } from "./nav";

export function openResearchDialog(urls?: string) {
  window.dispatchEvent(new CustomEvent("signalz:research", { detail: urls ?? "" }));
}

type Item = { id: string; name: string; domain: string | null; tier: string | null };

const TABS: (Bucket | "all")[] = ["call_today", "high_intent", "net_new", "warming_up", "recently_contacted", "routed", "all"];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Item[] | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchInitial, setResearchInitial] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || accounts) return;
    fetch("/api/accounts?compact=1")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAccounts(d.accounts))
      .catch(() => setAccounts([]));
  }, [open, accounts]);

  useEffect(() => {
    const onResearch = (e: Event) => {
      setResearchInitial((e as CustomEvent<string>).detail ?? "");
      setResearchOpen(true);
    };
    window.addEventListener("signalz:research", onResearch);
    return () => window.removeEventListener("signalz:research", onResearch);
  }, []);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setSearch("");
    fn();
  };
  const looksLikeUrl = /linkedin\.com\//i.test(search);

  return (
    <>
      <D.Root open={open} onOpenChange={onOpenChange}>
        <D.Portal>
          <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-[var(--overlay)]" />
          <D.Content className="animate-fade-in fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/10">
            <D.Title className="sr-only">Command menu</D.Title>
            <D.Description className="sr-only">Jump to an account, research a URL, switch tab, toggle theme or open settings</D.Description>
            <Command label="Command menu" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Jump to an account, paste a LinkedIn URL, or type a command…"
                className="h-12 w-full border-b border-line bg-transparent px-4 text-[14px] outline-none placeholder:text-muted"
              />
              <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">No results</Command.Empty>
                {looksLikeUrl ? (
                  <Command.Group heading="Research">
                    <PItem value={`research ${search}`} onSelect={() => run(() => openResearchDialog(search))} icon={<Crosshair size={14} />}>
                      Research {search.slice(0, 60)}
                    </PItem>
                  </Command.Group>
                ) : null}
                <Command.Group heading="Accounts">
                  {(accounts ?? []).map((a) => (
                    <PItem key={a.id} value={`${a.name} ${a.domain ?? ""} ${a.id}`} onSelect={() => run(() => router.push(`/accounts/${a.id}`))} icon={<Building2 size={14} />}>
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="text-[12px] text-muted">{a.domain}</span>
                    </PItem>
                  ))}
                  {accounts === null ? <div className="px-3 py-2 text-[13px] text-muted">Loading accounts…</div> : null}
                </Command.Group>
                <Command.Group heading="Actions">
                  <PItem value="research a linkedin url" onSelect={() => run(() => openResearchDialog())} icon={<Crosshair size={14} />}>
                    Research a LinkedIn URL
                  </PItem>
                  <PItem value="toggle theme dark light mode" onSelect={() => run(toggleTheme)} icon={<Moon size={14} />}>
                    Toggle theme
                  </PItem>
                  <PItem value="open settings" onSelect={() => run(() => router.push("/settings"))} icon={<Settings size={14} />}>
                    Open settings
                  </PItem>
                </Command.Group>
                <Command.Group heading="Today tabs">
                  {TABS.map((t) => (
                    <PItem key={t} value={`tab ${t === "all" ? "All" : BUCKET_LABEL[t]}`} onSelect={() => run(() => router.push(t === "call_today" ? "/" : `/?tab=${t}`))} icon={<LayoutDashboard size={14} />}>
                      Switch to {t === "all" ? "All" : BUCKET_LABEL[t]}
                    </PItem>
                  ))}
                </Command.Group>
                <Command.Group heading="Pages">
                  {NAV.map((n) => (
                    <PItem key={n.href} value={`go ${n.label}`} onSelect={() => run(() => router.push(n.href))} icon={<n.icon size={14} />}>
                      Go to {n.label}
                    </PItem>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
      <ResearchDialog open={researchOpen} onOpenChange={setResearchOpen} initial={researchInitial} />
    </>
  );
}

function PItem({ value, onSelect, icon, children }: { value: string; onSelect: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Command.Item value={value} onSelect={onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] data-[selected=true]:bg-hover">
      <span className="text-muted">{icon}</span>
      {children}
    </Command.Item>
  );
}
