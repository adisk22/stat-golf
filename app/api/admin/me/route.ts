import { connection } from "next/server";
import type { AdminMe } from "@/lib/admin-types";
import { requireAdmin } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export async function GET() {
  await connection();
  return handle(async (): Promise<AdminMe> => ({ email: (await requireAdmin()).user.email }));
}
