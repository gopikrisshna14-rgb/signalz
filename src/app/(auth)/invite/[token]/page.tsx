import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { AcceptInvite } from "./accept";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = await getStore();
  const invite = await store.getInvite(token);
  const valid = invite && !invite.acceptedAt && Date.parse(invite.expiresAt) > Date.now();
  const org = valid ? await store.getOrg(invite.orgId) : null;
  if (!valid || !org)
    return (
      <div>
        <h1 className="text-[20px] font-semibold">This invite is no longer valid</h1>
        <p className="mt-2 text-[14px] text-muted">Invites expire after 14 days or once used. Ask an admin of the workspace for a new link.</p>
        <Button asChild className="mt-6">
          <Link href="/">Go to Signalz</Link>
        </Button>
      </div>
    );
  const inviter = await store.getUser(invite.invitedBy);
  const user = await getSessionUser();
  const back = `/invite/${token}`;
  return (
    <div>
      <p className="text-[13px] font-medium text-accent">Invitation</p>
      <h1 className="mt-1 text-[20px] font-semibold">Join {org.name}</h1>
      <p className="mt-2 text-[14px] text-muted">
        {inviter?.name ?? "An admin"} invited <b className="text-fg">{invite.email}</b> as {invite.role}.
      </p>
      <div className="mt-6">
        {user ? (
          <AcceptInvite token={token} signedInAs={user.email} invitedEmail={invite.email} />
        ) : (
          <div className="flex flex-col gap-2">
            <Button asChild variant="primary" size="lg">
              <Link href={`/signup?callbackUrl=${encodeURIComponent(back)}&email=${encodeURIComponent(invite.email)}`}>Create an account</Link>
            </Button>
            <Button asChild size="lg">
              <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`}>I already have an account</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
