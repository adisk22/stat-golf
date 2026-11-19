import { z } from "zod";

/** Zod schemas for every API input. */
export const dateParam = z.union([z.literal("today"), z.iso.date()]);

export const guessBody = z.object({
  holeNumber: z.number().int().min(1).max(5),
  entityId: z.uuid(),
});

export const searchQuery = z.object({
  type: z.enum(["club", "player", "nation"]),
  q: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
