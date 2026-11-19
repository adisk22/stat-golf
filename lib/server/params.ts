import "server-only";
import { z } from "zod";
import { HttpError } from "./http";

export function uuidParam(v: string): string {
  const r = z.uuid().safeParse(v);
  if (!r.success) throw new HttpError(404, "Not found.");
  return r.data;
}

export function dateParam(v: string): string {
  const r = z.iso.date().safeParse(v);
  if (!r.success) throw new HttpError(400, "Invalid date.");
  return r.data;
}
