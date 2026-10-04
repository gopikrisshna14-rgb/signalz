import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { ProviderButtons } from "../provider-buttons";
import { SignupForm } from "./form";

export const metadata: Metadata = { title: "Join the beta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; email?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/onboarding";
  if (await getSessionUser()) redirect(callbackUrl);
  return (
    <div>
      <h1 className="text-[20px] font-semibold">Join the Signalz beta</h1>
      <p className="mt-1 mb-6 text-[14px] text-muted">Free during the beta. Up to 5 seats per workspace.</p>
      <ProviderButtons callbackUrl={callbackUrl} />
      <SignupForm callbackUrl={callbackUrl} defaultEmail={sp.email ?? ""} />
      <p className="mt-6 text-center text-[13px] text-muted">
        Have an account?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
