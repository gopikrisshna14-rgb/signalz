"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { OUTREACH_LABEL, type Angle, type OutreachType } from "@/lib/types";

async function api(url: string, method: string, payload?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Claim / release / log with optimistic callbacks and an undo toast. */
export function useAccountActions(opts: { onOptimistic?: (id: string, patch: { owner?: { userId: string; name: string } | null; contacted?: boolean }) => void; me: { id: string; name: string } }) {
  const router = useRouter();
  const { onOptimistic, me } = opts;

  const release = useCallback(
    async (id: string, name: string, quiet = false) => {
      onOptimistic?.(id, { owner: null });
      const r = await api(`/api/accounts/${id}/claim`, "DELETE");
      if (!r.ok) toast.error(r.data.message ?? "Could not release");
      else if (!quiet) toast.success(`Released ${name}`);
      router.refresh();
    },
    [onOptimistic, router],
  );

  const claim = useCallback(
    async (id: string, name: string) => {
      onOptimistic?.(id, { owner: { userId: me.id, name: me.name } });
      const r = await api(`/api/accounts/${id}/claim`, "POST");
      if (!r.ok) {
        onOptimistic?.(id, { owner: r.data.owner ?? null });
        toast.error(r.data.message ?? "Could not claim");
      } else toast.success(`Claimed ${name}`, { action: { label: "Undo", onClick: () => void release(id, name, true) } });
      router.refresh();
    },
    [onOptimistic, router, me, release],
  );

  const log = useCallback(
    async (id: string, name: string, type: OutreachType, extra: { personId?: string | null; angle?: Angle | null } = {}) => {
      onOptimistic?.(id, { contacted: true });
      const r = await api("/api/outreach", "POST", { companyId: id, type, personId: extra.personId ?? null, angle: extra.angle ?? null });
      if (!r.ok) {
        toast.error(r.data.message ?? "Could not log");
        router.refresh();
        return;
      }
      toast.success(`${OUTREACH_LABEL[type]} · ${name}${r.data.claimed ? " (claimed for you)" : ""}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await api("/api/outreach", "DELETE", { id: r.data.event.id, companyId: id });
            router.refresh();
          },
        },
      });
      router.refresh();
    },
    [onOptimistic, router],
  );

  return { claim, release, log };
}
