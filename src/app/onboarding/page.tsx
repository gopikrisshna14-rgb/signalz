import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase
    .from("memberships")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");
  if ((count ?? 0) > 0) redirect("/");

  const company = user.email?.split("@")[1]?.split(".")[0] ?? "";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <h1 className="text-[20px] font-semibold">Create your workspace</h1>
        <p className="mt-1 mb-6 text-muted">
          A workspace holds your team&apos;s accounts, signals and settings. You can invite teammates later.
        </p>
        <OnboardingForm suggestedName={company ? company.charAt(0).toUpperCase() + company.slice(1) : ""} />
        <p className="mt-6 text-[13px] text-muted">
          Your company already uses Hiring Signals? Ask your admin for an invite instead.
        </p>
      </div>
    </main>
  );
}
