"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import { Button, Input, Label } from "@/components/ui";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return (base.length >= 2 ? base : "team") + "-" + Math.random().toString(36).slice(2, 6);
}

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    const loadDemo = form.get("demo") === "on";
    setBusy(true);
    const supabase = createClient();
    const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slugify(name) });
    if (error) {
      setBusy(false);
      return toast.error(errorMessage(error));
    }
    if (loadDemo) {
      const { error: seedError } = await supabase.rpc("seed_demo", { p_org: orgId });
      if (seedError) toast.error(`Workspace created, but demo data failed: ${errorMessage(seedError)}`);
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={suggestedName} placeholder="e.g. HubSpot DACH" required maxLength={120} />
      </div>
      <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-[13px]">
        <input type="checkbox" name="demo" defaultChecked className="mt-0.5 accent-[var(--accent)]" />
        <span>
          <span className="font-medium">Load demo data</span>
          <span className="block text-muted">Eight fictional companies, so you can explore the dashboard right away.</span>
        </span>
      </label>
      <Button variant="primary" className="w-full" disabled={busy}>
        {busy ? "Setting up…" : "Create workspace"}
      </Button>
    </form>
  );
}
