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

/** Creates a confirmed user (admin unless told otherwise) and signs the page in via a magic-link token. */
export async function signInAs(page: import("@playwright/test").Page, opts: { admin?: boolean; next?: string } = {}) {
  const db = serviceClient();
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error || !created.user) throw error ?? new Error("createUser failed");
  if (opts.admin !== false) {
    const { error: pErr } = await db.from("profiles").update({ is_admin: true }).eq("user_id", created.user.id);
    if (pErr) throw pErr;
  }
  const { data: link, error: lErr } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (lErr) throw lErr;
  const next = encodeURIComponent(opts.next ?? "/admin");
  await page.goto(`/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=${next}`);
  return { email, userId: created.user.id };
}
