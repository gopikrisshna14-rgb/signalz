"use client";

import { useEffect, useState } from "react";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import type { AccountDetail } from "@/lib/account-detail";
import { AccountDetailView } from "./account-detail";

export function AccountDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/accounts/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (r.ok) setDetail(data);
        else setError(data.message ?? "Could not load the account");
      })
      .catch(() => !cancelled && setError("Could not load the account"));
    return () => {
      cancelled = true;
    };
  }, [id]);
  return (
    <Dialog open={Boolean(id)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent title={detail?.company.name ?? "Account"} hideTitle wide>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error ? <p className="text-[13px] text-danger-fg">{error}</p> : null}
          {!detail && !error ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading account">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-24" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : null}
          {detail ? <AccountDetailView detail={detail} compact /> : null}
        </div>
      </SheetContent>
    </Dialog>
  );
}
