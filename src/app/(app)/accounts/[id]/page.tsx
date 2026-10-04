import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountDetailView } from "@/components/account/account-detail";
import { accountDetail } from "@/lib/account-detail";
import { pageCtx } from "@/lib/auth/context";
import { getStore } from "@/lib/store";

type P = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params;
  const company = await (await getStore()).getCompany(id);
  return { title: company?.name ?? "Account" };
}

export default async function AccountPage({ params }: P) {
  const { id } = await params;
  const ctx = await pageCtx();
  const store = await getStore();
  const company = await store.getCompany(id);
  const members = company ? await store.getMembers(company.orgId) : {};
  if (!company || members[ctx.user.id]?.status !== "active") notFound();
  const detail = await accountDetail(store, company, { ...ctx, role: members[ctx.user.id].role, isAdmin: members[ctx.user.id].role !== "member" });
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-muted">
        <Link href="/" className="hover:text-fg hover:underline">
          Today
        </Link>{" "}
        / {company.name}
      </nav>
      <AccountDetailView detail={detail} />
    </div>
  );
}
