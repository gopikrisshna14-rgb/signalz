import type { NextAuthConfig } from "next-auth";

const hasRedis = Boolean((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));

const PUBLIC = [/^\/welcome/, /^\/login/, /^\/signup/, /^\/invite\//];

/** Edge-safe part of the Auth.js config (used by the middleware). Providers live in src/auth.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  trustHost: true,
  // Without AUTH_SECRET a fixed secret is used only in development or in demo mode (no Redis: nothing is stored).
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV !== "production" || !hasRedis ? "signalz-dev-secret-change-me-in-production" : undefined),
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (PUBLIC.some((re) => re.test(pathname))) return true;
      if (auth?.user) return true;
      if (pathname === "/") return Response.redirect(new URL("/welcome", request.nextUrl));
      return false;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = String(token.uid);
      return session;
    },
  },
} satisfies NextAuthConfig;
