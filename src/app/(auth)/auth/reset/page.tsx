"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";

export default function ResetPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[20px] font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <Button variant="primary" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </>
  );
}
