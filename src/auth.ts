import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { demoLoginEnabled, enabledProviders } from "./lib/auth/providers";
import { newId } from "./lib/ids";
import { ensureDemoWorkspace, getStore } from "./lib/store";

class InvalidLogin extends CredentialsSignin {
  code = "invalid";
}

const providers: Provider[] = [
  Credentials({
    id: "password",
    name: "E-mail and password",
    credentials: { email: { label: "E-mail", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(raw);
      if (!parsed.success) throw new InvalidLogin();
      const store = await getStore();
      const user = await store.getUserByEmail(parsed.data.email.toLowerCase());
      if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new InvalidLogin();
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (demoLoginEnabled())
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo account",
      credentials: {},
      async authorize() {
        const user = await ensureDemoWorkspace(await getStore());
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );

const enabled = enabledProviders();
if (enabled.google) providers.push(Google({ allowDangerousEmailAccountLinking: true }));
if (enabled.microsoft)
  providers.push(
    MicrosoftEntraID({
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "https://login.microsoftonline.com/common/v2.0",
      allowDangerousEmailAccountLinking: true,
    }),
  );

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    /** OAuth users are created in the store on their first sign-in; the token carries our user id. */
    async jwt({ token, user, account }) {
      if (account && account.type !== "credentials" && user?.email) {
        const store = await getStore();
        const email = user.email.toLowerCase();
        let existing = await store.getUserByEmail(email);
        if (!existing) {
          existing = { id: newId("u"), email, name: user.name ?? email.split("@")[0], image: user.image ?? null, defaultOrgId: null, createdAt: new Date().toISOString() };
          await store.putUser(existing);
        } else if (!existing.image && user.image) {
          existing = { ...existing, image: user.image };
          await store.putUser(existing);
        }
        token.uid = existing.id;
        return token;
      }
      if (user?.id) token.uid = user.id;
      return token;
    },
  },
});
