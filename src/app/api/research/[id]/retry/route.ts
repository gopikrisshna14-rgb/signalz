import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToN8n } from "@/lib/n8n";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { error } = await supabase.rpc("retry_research", { p_request: id });
  if (error) {
    const status = error.message.includes("forbidden") ? 403 : error.message.includes("not_failed") ? 409 : 404;
    return NextResponse.json({ error: "retry_failed", message: error.message }, { status });
  }

  const { data: req } = await supabase.from("research_requests").select("id, org_id, linkedin_url, kind").eq("id", id).single();
  if (!req) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sent = await sendToN8n({ request_id: req.id, org_id: req.org_id, linkedin_url: req.linkedin_url, kind: req.kind });
  if (!sent.ok) {
    // mark_research_dispatch only marks the requester's own rows; an admin retrying someone else's sees the error here.
    await supabase.rpc("mark_research_dispatch", { p_request: id, p_ok: false, p_error: sent.error });
    return NextResponse.json({ ok: false, message: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
