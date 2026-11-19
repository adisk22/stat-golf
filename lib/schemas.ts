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

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const entityType = z.enum(["club", "player", "nation"]);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

export const questionInput = z.object({
  prompt: z.string().trim().min(3).max(200),
  answerType: entityType,
  statLabel: z.string().trim().min(1).max(60),
  valueOrder: z.enum(["desc", "asc"]),
  scopeNote: optionalText(300),
  sourceName: optionalText(120),
  sourceUrl: z
    .union([z.literal(""), z.url({ protocol: /^https?$/ })])
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional(),
  dataAsOf: z
    .union([z.literal(""), z.iso.date()])
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional(),
});

export const questionPatch = questionInput.partial().extend({
  status: z.enum(["draft", "ready"]).optional(),
});

export const matchInput = z.object({ csv: z.string().min(1).max(500_000) });

const newEntity = z.object({
  name: z.string().trim().min(1).max(120),
  country: optionalText(60),
  disambiguation: optionalText(80),
});

export const rankingInput = z.object({
  rows: z
    .array(
      z
        .object({
          line: z.number().int().min(1),
          rank: z.number().int().min(1),
          value: z.number().finite(),
          entityId: z.uuid().nullable().optional(),
          newEntity: newEntity.nullable().optional(),
        })
        .refine((r) => Boolean(r.entityId) !== Boolean(r.newEntity), {
          message: "each row needs exactly one of entityId or newEntity",
        }),
    )
    .min(1)
    .max(2000),
});

export const entityInput = newEntity.extend({
  type: entityType,
  aliases: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});

export const entityPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  country: optionalText(60),
  disambiguation: optionalText(80),
});

export const mergeInput = z.object({ keepId: z.uuid(), removeId: z.uuid() });

export const entitySearch = z.object({
  type: entityType,
  q: z.string().trim().max(60).default(""),
});

export const scheduleRange = z.object({ from: z.iso.date(), to: z.iso.date() });

export const puzzleInput = z.object({
  holes: z
    .array(
      z.object({
        questionId: z.uuid(),
        targetRank: z.number().int().min(1),
        par: z.number().int().min(1).max(15),
      }),
    )
    .max(5),
});

export const publishInput = z.object({ published: z.boolean() });
