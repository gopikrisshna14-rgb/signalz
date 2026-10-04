import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/context";
import { ProviderButtons } from "../provider-buttons";
import { PasswordLoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This e-mail is linked to another sign-in method.",
  AccessDenied: "Access denied.",
  Configuration: "Sign-in is not configured correctly. Check AUTH_SECRET and the provider settings.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl?.startsWith("/") ? sp.callbackUrl : "/";
  if (await getSessionUser()) redirect(callbackUrl);
  return (
    <div>
      <h1 className="text-[20px] font-semibold">Sign in to Signalz</h1>
      <p className="mt-1 mb-6 text-[14px] text-muted">Hiring signals for SDRs, in beta.</p>
      {sp.error ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">
          {ERRORS[sp.error] ?? "Sign-in failed. Try again."}
        </p>
      ) : null}
      <ProviderButtons callbackUrl={callbackUrl} />
      <PasswordLoginForm callbackUrl={callbackUrl} />
      <p className="mt-6 text-center text-[13px] text-muted">
        New here?{" "}
        <Link href={`/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-medium text-accent hover:underline">
          Join the beta
        </Link>
      </p>
    </div>
  );
}
