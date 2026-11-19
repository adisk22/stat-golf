import "server-only";
import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/game-types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

/** Postgres errors raised deliberately by our triggers/RPCs carry a user-facing message. */
const USER_FACING_PG_CODES: Record<string, number> = {
  "23514": 409, // check_violation (our triggers)
  "23505": 409, // unique_violation
  "42501": 403, // insufficient_privilege
  P0002: 404, // no_data_found
};

/** Wraps a handler so HttpErrors (and our deliberate DB errors) become JSON responses. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof HttpError) {
      return json<ApiError>({ error: err.message }, { status: err.status });
    }
    const pg = err as { code?: string; message?: string };
    if (pg && typeof pg.code === "string" && pg.code in USER_FACING_PG_CODES && pg.message) {
      return json<ApiError>({ error: pg.message }, { status: USER_FACING_PG_CODES[pg.code] });
    }
    console.error(err);
    return json<ApiError>({ error: "Something went wrong." }, { status: 500 });
  }
}

/** Parses a JSON body with a Zod-like schema, or throws 400. */
export async function readJson<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }): Promise<T> {
  const body = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.");
  }
  return parsed.data;
}
