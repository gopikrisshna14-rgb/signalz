"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import { Button } from "@/components/ui";

export function AdminActions({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(fn: "seed_demo" | "rescore_org", done: string) {
    setBusy(fn);
    const { error } = await createClient().rpc(fn, { p_org: orgId });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(done);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
      <Button size="sm" onClick={() => run("seed_demo", "Demo data loaded")} disabled={busy !== null}>
        {busy === "seed_demo" ? "Loading…" : "Load demo data"}
      </Button>
      <Button size="sm" onClick={() => run("rescore_org", "All accounts re-scored")} disabled={busy !== null}>
        {busy === "rescore_org" ? "Re-scoring…" : "Re-score all accounts"}
      </Button>
    </div>
  );
}
