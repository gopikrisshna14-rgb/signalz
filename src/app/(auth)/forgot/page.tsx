"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";

export default function ForgotPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  return (
    <>
      <h1 className="text-[20px] font-semibold">Reset your password</h1>
      {sent ? (
        <p className="mt-2 text-muted">If an account exists for that e-mail, a reset link is on its way.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Work e-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <Button variant="primary" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-[13px]">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
