"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

const safe = (to: unknown) => (typeof to === "string" && to.startsWith("/") && !to.startsWith("//") ? to : "/");

export async function loginWithPassword(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  try {
    await signIn("password", { email: form.get("email"), password: form.get("password"), redirectTo: safe(form.get("callbackUrl")) });
    return {};
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong e-mail or password." };
    throw e;
  }
}

export async function loginWithProvider(form: FormData) {
  const provider = String(form.get("provider"));
  if (!["google", "microsoft-entra-id", "demo"].includes(provider)) return;
  await signIn(provider, { redirectTo: safe(form.get("callbackUrl")) });
}

export async function logout() {
  await signOut({ redirectTo: "/welcome" });
}
