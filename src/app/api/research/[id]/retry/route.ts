import { json, notFound, route } from "@/lib/api";
import { requireMember } from "@/lib/auth/context";
import { startFirst } from "@/lib/pipeline/steps";
import { getStore } from "@/lib/store";

/** Restart a research request from the first step. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const store = await getStore();
  const r = await store.getResearch(id);
  if (!r) throw notFound("Research request not found");
  await requireMember(r.orgId);
  const next = await startFirst(store, { ...r, runIds: r.runIds });
  return json({ id: next.id, status: next.status });
});
