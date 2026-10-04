import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { activeOrgs, getSessionUser } from "@/lib/auth/context";
import { getStore } from "@/lib/store";
import { activeCount } from "@/lib/workspace";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/onboarding");
  const { step } = await searchParams;
  const orgs = await activeOrgs(user);
  const current = orgs.find((o) => o.org.id === user.defaultOrgId) ?? orgs[0];
  if (step === "demo" && current) return <Onboarding mode="demo" orgName={current.org.name} isAdmin={current.membership.role !== "member"} />;
  if (orgs.length && step !== "new") redirect("/");

  const store = await getStore();
  const domain = user.email.split("@")[1]?.toLowerCase() ?? "";
  const match = domain ? await store.findOrgByDomain(domain) : null;
  const autoJoin = match && match.autoJoin && !orgs.some((o) => o.org.id === match.id) ? { id: match.id, name: match.name, full: activeCount(await store.getMembers(match.id)) >= match.seatLimit } : null;
  return <Onboarding mode="start" autoJoin={autoJoin} domain={domain} userName={user.name} />;
}
