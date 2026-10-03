"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import type { Account, Workspace } from "@/lib/types";
import { AccountDetail } from "@/components/account/account-detail";

export function AccountPage({ account, workspace }: { account: Account; workspace: Workspace }) {
  const router = useRouter();
  async function claim(a: Account) {
    const release = a.owner_id === workspace.userId;
    const { error } = await createClient().rpc("claim_account", { p_company: a.id, p_release: release });
    if (error) return toast.error(errorMessage(error));
    toast.success(release ? `Released ${a.name}` : `You own ${a.name} now`);
    router.refresh();
  }
  return <AccountDetail account={account} workspace={workspace} onClaim={claim} />;
}
