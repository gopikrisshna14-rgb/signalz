import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (hasSupabaseEnv) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-[20px] font-semibold">Almost there: connect Supabase</h1>
      <p className="mt-2 text-muted">The app is deployed, but it does not know which Supabase project to use yet.</p>
      <ol className="mt-6 list-decimal space-y-3 pl-5">
        <li>
          In Supabase, open <b>Project Settings → API</b> and copy the <b>Project URL</b> and the <b>anon / publishable</b> key.
        </li>
        <li>
          In Vercel, open <b>Settings → Environment Variables</b> and add:
          <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-[12px]">
            NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY
          </pre>
        </li>
        <li>
          Open <b>Deployments</b>, click <b>⋯</b> on the latest one and choose <b>Redeploy</b>.
        </li>
      </ol>
    </main>
  );
}
