"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { loginWithPassword } from "../actions";

export function SignupForm({ callbackUrl, defaultEmail }: { callbackUrl: string; defaultEmail: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Sign-up failed");
        return;
      }
      form.set("callbackUrl", callbackUrl);
      const r = await loginWithPassword(undefined, form);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required maxLength={80} />
      </Field>
      <Field label="Work e-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-danger-fg">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
