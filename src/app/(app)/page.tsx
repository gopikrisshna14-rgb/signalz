import { pageCtx } from "@/lib/auth/context";

export default async function TodayPage() {
  const ctx = await pageCtx();
  return <h1 className="text-[20px] font-semibold">Hiring signals · {ctx.org.name}</h1>;
}
