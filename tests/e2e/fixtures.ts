import { serviceClient, dayOffset } from "../db/helpers";

/** Looks up today's holes and an entity sitting exactly on each target (service role). */
export async function todaysTargets() {
  const db = serviceClient();
  const { data: holes, error } = await db
    .from("daily_holes")
    .select("hole_number, question_id, target_rank")
    .eq("date", dayOffset(0))
    .order("hole_number");
  if (error || !holes) throw error ?? new Error("no holes");
  const out: { holeNumber: number; targetName: string }[] = [];
  for (const h of holes) {
    const { data, error: rErr } = await db
      .from("question_rankings")
      .select("entity:entities!inner(name)")
      .eq("question_id", h.question_id)
      .eq("rank", h.target_rank)
      .limit(1)
      .single();
    if (rErr || !data) throw rErr ?? new Error("no target entity");
    out.push({ holeNumber: h.hole_number, targetName: (data.entity as unknown as { name: string }).name });
  }
  return out;
}

export { dayOffset };
