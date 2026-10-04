import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new ApiError(404, "not_found", what);
export const forbidden = (msg = "You do not have access to this") => new ApiError(403, "forbidden", msg);
export const badRequest = (msg: string) => new ApiError(400, "bad_request", msg);

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wraps a route handler: typed JSON errors `{ error, message }` for ApiError and zod failures. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.code, message: e.message, ...e.extra }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "invalid_input", message: e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "internal", message: e instanceof Error ? e.message : "Something went wrong" }, { status: 500 });
    }
  };
}

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  return schema.parse(raw);
}
