"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NoSeatDialog } from "@/components/no-seat-dialog";
import { Button } from "@/components/ui/button";
import { logout } from "../../actions";

export function AcceptInvite({ token, signedInAs, invitedEmail }: { token: string; signedInAs: string; invitedEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noSeat, setNoSeat] = useState<string | null>(null);
  const mismatch = signedInAs.toLowerCase() !== invitedEmail.toLowerCase();

  function accept() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else if (data.error === "no_seat") setNoSeat(data.message);
      else setError(data.message ?? "Could not accept the invite");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">Signed in as {signedInAs}.</p>
      {mismatch ? (
        <p className="rounded-[10px] bg-warm-bg px-3 py-2 text-[13px] text-warm-fg">This invite is for {invitedEmail}. Sign out and sign in with that e-mail.</p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" size="lg" onClick={accept} disabled={pending || mismatch}>
          {pending ? "Joining…" : "Accept and join"}
        </Button>
        <form action={logout}>
          <Button type="submit" size="lg" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-danger-fg">
          {error}
        </p>
      ) : null}
      <NoSeatDialog open={noSeat !== null} onOpenChange={(v) => !v && setNoSeat(null)} message={noSeat ?? ""} />
    </div>
  );
}
