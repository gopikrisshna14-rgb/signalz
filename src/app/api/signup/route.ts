import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError, body, json, route } from "@/lib/api";
import { newId } from "@/lib/ids";
import { getStore } from "@/lib/store";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const POST = route(async (req: Request) => {
  const input = await body(req, Body);
  const store = await getStore();
  const limit = await store.hit(`signup:${req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`, 3600);
  if (limit > 20) throw new ApiError(429, "rate_limited", "Too many sign-ups from this network. Try again later.");
  if (await store.getUserByEmail(input.email)) throw new ApiError(409, "email_taken", "An account with this e-mail exists. Sign in instead.");
  await store.putUser({
    id: newId("u"),
    email: input.email,
    name: input.name,
    image: null,
    passwordHash: await bcrypt.hash(input.password, 10),
    defaultOrgId: null,
    createdAt: new Date().toISOString(),
  });
  return json({ ok: true }, { status: 201 });
});
