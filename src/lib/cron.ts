import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "cron_disabled", "CRON_SECRET is not set");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new ApiError(401, "unauthorized", "Bad cron secret");
}
