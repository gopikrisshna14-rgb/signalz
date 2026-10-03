"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password: String(form.get("password")),
      options: {
        data: { full_name: String(form.get("full_name")) },
        emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      // E-mail confirmation is switched off in Supabase: signed in straight away.
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div>
        <MailCheck className="mb-4 text-accent" size={28} />
        <h1 className="text-[20px] font-semibold">Check your inbox</h1>
        <p className="mt-2 text-muted">
          We sent a confirmation link to <span className="font-medium text-fg">{sentTo}</span>. Open it on this device to
          finish signing up.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[20px] font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-muted">Find companies building a sales team, before anyone else calls.</p>
      <GoogleButton next="/onboarding" />
      <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" /> or with e-mail <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required maxLength={120} />
        </div>
        <div>
          <Label htmlFor="email">Work e-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="mt-1 text-[12px] text-muted">At least 8 characters.</p>
        </div>
        <Button variant="primary" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
