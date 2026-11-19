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

/** Wraps a handler so HttpErrors become JSON responses and anything else a 500. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof HttpError) {
      return json<ApiError>({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return json<ApiError>({ error: "Something went wrong." }, { status: 500 });
  }
}
