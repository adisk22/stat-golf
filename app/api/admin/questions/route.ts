import { connection } from "next/server";
import { questionInput } from "@/lib/schemas";
import { createQuestion, listQuestions } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson } from "@/lib/server/http";

export async function GET() {
  await connection();
  return handle(async () => listQuestions((await requireAdmin()).db));
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAdmin();
    const body = await readJson(req, questionInput);
    return createQuestion(ctx, {
      ...body,
      scopeNote: body.scopeNote ?? null,
      sourceName: body.sourceName ?? null,
      sourceUrl: body.sourceUrl ?? null,
      dataAsOf: body.dataAsOf ?? null,
    });
  });
}
