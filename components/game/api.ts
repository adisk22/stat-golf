import type { ApiError } from "@/lib/game-types";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : `Request failed (${res.status})`;
    throw new ApiRequestError(res.status, message);
  }
  return body as T;
}
