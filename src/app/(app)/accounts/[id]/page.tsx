import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";
import type { Account } from "@/lib/types";
import { AccountPage } from "./account-page";

export default async function AccountRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ws = await requireWorkspace();
  const supabase = await createClient();
  const { data } = await supabase.from("v_accounts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Today
      </Link>
      <AccountPage account={data as Account} workspace={ws} />
    </div>
  );
}
