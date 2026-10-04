"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pills";
import { relativeTime } from "@/lib/format";
import type { Signal } from "@/lib/types";

function line(s: Signal) {
  if (s.type === "tier_changed") {
    const person = s.payload.person as string | null;
    return (
      <>
        <span className="font-semibold">{s.title}</span>
        {person ? <span className="text-muted"> · {person}</span> : null}
      </>
    );
  }
  return <span>{s.title}</span>;
}

export function JustChanged({ initial, onOpen }: { initial: Signal[]; onOpen: (id: string) => void }) {
  const [signals, setSignals] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setSignals(initial), [initial]);
  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      if (document.hidden) return;
      const r = await fetch("/api/signals?limit=40").catch(() => null);
      if (r?.ok) setSignals((await r.json()).signals);
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader title="Just changed" description="Updates every 30 seconds" />
      <ul className="mt-2 max-h-[330px] flex-1 overflow-y-auto px-2 pb-2" aria-live="polite">
        {signals.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[13px] text-muted">
            <Activity size={18} aria-hidden /> Nothing changed yet. New clusters and tier upgrades show up here.
          </li>
        ) : null}
        {signals.map((s) => {
          const fresh = now - Date.parse(s.at) < 86_400_000;
          return (
            <li key={s.id}>
              <button onClick={() => onOpen(s.companyId)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{s.companyName}</span>
                    {fresh && (s.type === "hiring_cluster" || s.type === "new_sales_leader") ? <Pill tone="accent">NEW</Pill> : null}
                    {fresh && (s.type === "tier_changed" || s.type === "cluster_grew") ? <Pill tone="hot">UPGRADED</Pill> : null}
                  </div>
                  <div className="truncate text-[12px]">{line(s)}</div>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{relativeTime(s.at, now)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
