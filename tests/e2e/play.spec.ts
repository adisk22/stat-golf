import { expect, test, type Page } from "@playwright/test";
import { dayOffset, todaysTargets } from "./fixtures";

async function guess(page: Page, query: string, pick?: string) {
  const input = page.getByRole("combobox", { name: "Your guess" });
  await input.fill(query);
  const option = pick ? page.getByRole("option", { name: pick }) : page.getByRole("option").first();
  await option.click();
  await page.getByRole("button", { name: "Take the shot" }).click();
}

test("anonymous play-through of today's seeded round", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const targets = await todaysTargets();
  await page.goto("/");

  // Hole 1: guess the exact target entity -> hole in one.
  await expect(page.getByTestId("prompt")).toContainText("SAMPLE — not real data");
  await guess(page, targets[0]!.targetName, targets[0]!.targetName);
  await expect(page.getByTestId("hole-result")).toHaveText("Hole in one!");
  await expect(page.getByTestId("reveal-1").locator("tr[data-target][data-guess]")).toHaveCount(1);
  await expect(page.getByTestId("strokes-1")).toHaveText("0");

  // Remaining holes: any club.
  const queries = ["Mockford", "Lorem", "Ipsum", "Dummy"];
  for (let n = 2; n <= targets.length; n++) {
    await page.getByRole("button", { name: `Tee off on hole ${n}` }).click();
    await guess(page, queries[n - 2]!);
    await expect(page.getByTestId(`reveal-${n}`)).toBeVisible();
  }
  await page.getByRole("button", { name: "See your round" }).click();

  const end = page.getByTestId("end-screen");
  await expect(end).toBeVisible();
  const total = Number(await page.getByTestId("final-total").textContent());
  let sum = 0;
  for (let n = 1; n <= targets.length; n++) sum += Number(await page.getByTestId(`strokes-${n}`).textContent());
  expect(total).toBe(sum);

  await end.getByRole("button", { name: "Share result" }).click();
  await expect(end.getByRole("status")).toHaveText("Copied to clipboard");
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toMatch(new RegExp(`^Stat Golf #\\d+  ⛳ ${total} \\((E|[+-]\\d+)\\)\\n🟢(🟢|🟡|🟠|🔴){${targets.length - 1}}`, "u"));
  // No spoilers: no prompts or entity names.
  expect(shared).not.toContain("SAMPLE");
  expect(shared).not.toContain(targets[0]!.targetName);
});

test("refresh mid-round keeps progress and a hole can't be guessed twice", async ({ page }) => {
  await page.goto("/");
  await guess(page, "Fakeville");
  await expect(page.getByTestId("reveal-1")).toBeVisible();
  const strokes1 = await page.getByTestId("strokes-1").textContent();

  await page.reload();
  await expect(page.getByText("Hole 2 · par")).toBeVisible();
  await expect(page.getByTestId("strokes-1")).toHaveText(strokes1!);

  // Replaying hole 1 through the API is rejected.
  const club = await page.request.get("/api/entities/search?type=club&q=mockford");
  const [{ id }] = (await club.json()) as { id: string }[];
  const again = await page.request.post("/api/play/today/guess", { data: { holeNumber: 1, entityId: id } });
  expect(again.status()).toBe(409);

  // Skipping ahead is rejected too.
  const skip = await page.request.post("/api/play/today/guess", { data: { holeNumber: 3, entityId: id } });
  expect(skip.status()).toBe(409);

  // The state never contains later holes' prompts.
  const state = await (await page.request.get("/api/play/today")).json();
  expect(state.holes[1].status).toBe("current");
  for (const h of state.holes.slice(2)) {
    expect(h).toEqual({ status: "locked", holeNumber: h.holeNumber, par: h.par });
  }
});

test("future puzzles can't be fetched and the API requires a session", async ({ page, request }) => {
  const anon = await request.get("/api/play/today");
  expect(anon.status()).toBe(401);

  await page.goto("/");
  await expect(page.getByTestId("prompt")).toBeVisible();
  const future = await page.request.get(`/api/play/${dayOffset(1)}`);
  expect(future.status()).toBe(404);
  const futureGuess = await page.request.post(`/api/play/${dayOffset(1)}/guess`, {
    data: { holeNumber: 1, entityId: "00000000-0000-4000-8000-000000000000" },
  });
  expect(futureGuess.status()).toBe(404);
});
