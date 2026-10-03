"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Email not confirmed" ? "Please confirm your e-mail first (check your inbox)." : error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[20px] font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-muted">Welcome back. Your hot accounts are waiting.</p>
      {params.get("error") && (
        <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">{params.get("error")}</p>
      )}
      <GoogleButton next={next} />
      <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" /> or with e-mail <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Work e-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot" className="text-[13px] text-accent hover:underline">
              Forgot?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button variant="primary" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
