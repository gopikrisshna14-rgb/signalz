"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Maximize2, X } from "lucide-react";
import type { Account, Workspace } from "@/lib/types";
import { AccountDetail } from "./account-detail";

export function AccountDrawer({
  accountId,
  account,
  workspace,
  onClose,
  onClaim,
}: {
  accountId: string | null;
  account: Account | null;
  workspace: Workspace;
  onClose: () => void;
  onClaim: (a: Account) => void;
}) {
  useEffect(() => {
    if (!accountId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [accountId, onClose]);

  if (!accountId || !account) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={account.name}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col border-l border-line bg-bg">
        <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-line px-3">
          <Link
            href={`/accounts/${account.id}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Open as page"
            title="Open as page"
          >
            <Maximize2 size={15} />
          </Link>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
            autoFocus
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <AccountDetail key={account.id} account={account} workspace={workspace} onClaim={onClaim} />
        </div>
      </aside>
    </div>
  );
}
