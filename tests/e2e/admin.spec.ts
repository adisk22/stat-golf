import { expect, test } from "@playwright/test";
import { dayOffset, signInAs } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("non-admins are turned away from /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("alert").filter({ hasText: "Sign in with your admin email." })).toBeVisible();
  await signInAs(page, { admin: false });
  await expect(page.getByRole("alert").filter({ hasText: "This account is not an admin." })).toBeVisible();
});

test("admin creates a question, imports a CSV with review, schedules and publishes a day", async ({ page }) => {
  await signInAs(page);
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();

  // 1. Create a question.
  const prompt = `E2E sample question ${Date.now()}`;
  await page.getByRole("link", { name: "New question" }).click();
  await page.getByLabel("Prompt").fill(prompt);
  await page.getByLabel("Stat label").fill("Made-up points");
  await page.getByLabel("Scope note").fill("Fake data from the e2e test.");
  await page.getByRole("button", { name: "Create and import ranking" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(prompt) })).toBeVisible();

  // 2. A CSV with a bad gap is rejected with a line number.
  const csvBox = page.getByLabel("CSV text");
  await csvBox.fill("rank,name,value\n1,Mockford Town,40\n3,PHC,30");
  await page.getByRole("button", { name: "Check & match names" }).click();
  await expect(page.getByText("Line 3: Expected rank 2")).toBeVisible();

  // 3. Valid CSV: exact, alias, fuzzy, unknown (+ tie), plus enough rows for targets.
  // Random letters only, so it never fuzzy-matches entities created by earlier runs.
  const newName = `Zq${crypto.randomUUID().replace(/[^a-f]/g, "").slice(0, 10)}`;
  const extra = ["Ipsum Wanderers", "Dummy Rovers", "Sampleton Albion", "Testbury FC", "Stubford Orient"]
    .map((n, i) => `${i + 5},${n},${15 - i}`)
    .join("\n");
  await csvBox.fill(`rank,name,value\n1,Mockford Town,40\n2,PHC,30\n2,Lorem Athletik,30\n4,${newName},20\n${extra}`);
  await page.getByRole("button", { name: "Check & match names" }).click();
  await expect(page.getByText("9 rows · 2 need review")).toBeVisible();

  const row = (line: number) => page.locator("tr", { has: page.getByLabel(`Match for line ${line}`) });
  await expect(row(2).getByText("exact")).toBeVisible();
  await expect(row(3).getByText("alias")).toBeVisible();
  await expect(row(4).getByText("fuzzy")).toBeVisible();
  await expect(row(5).getByText("no match")).toBeVisible();
  await expect(page.getByLabel("Match for line 4").locator("option:checked")).toContainText("Lorem Athletic");

  const save = page.getByRole("button", { name: "Save 9 rows" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Confirm line 4").check();
  await page.getByLabel("Match for line 5").selectOption("__new");
  await expect(page.getByLabel("New name")).toHaveValue(newName);
  await save.click();
  await expect(page.getByText("Saved 9 rows, created 1 new clubs.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current ranking (9 rows)" })).toBeVisible();

  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByTestId("question-status")).toHaveText("ready");

  // 4. Schedule a far-future day with this question + two seeded ones, then publish.
  const date = dayOffset(400 + Math.floor(Math.random() * 300));
  await page.goto(`/admin/schedule/${date}`);
  await expect(page.getByTestId("puzzle-status")).toHaveText("empty");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "+ Add hole" }).click();
  await page.getByLabel("Hole 1 question").selectOption({ label: `${prompt} (9 rows)` });

  // Only ranks someone holds are offered: rank 3 sits inside the 2/2 tie.
  const targets = await page.getByLabel("Hole 1 target").locator("option").allTextContents();
  expect(targets).toEqual(["1st", "2nd", "4th", "5th", "6th", "7th", "8th", "9th"]);
  await page.getByLabel("Hole 1 target").selectOption({ label: "4th" });

  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByTestId("puzzle-status")).toHaveText("draft");

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("prompt").first()).toHaveText(prompt);
  await expect(page.getByTestId("target").first()).toHaveText("Target: 4th");
  await page.getByRole("button", { name: "Edit" }).click();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("puzzle-status")).toHaveText("published");

  // Unpublish again so repeated runs don't pile up future puzzles.
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByTestId("puzzle-status")).toHaveText("draft");
});

test("admin edits an entity's aliases", async ({ page }) => {
  await signInAs(page, { next: "/admin/entities" });
  await page.getByPlaceholder("Search names and aliases…").fill("widget town");
  const row = page.locator("li", { hasText: "Widget Town" }).first();
  await row.getByRole("button", { name: "Edit" }).click();
  const alias = `WT${Date.now() % 10000}`;
  await row.getByLabel("Aliases").fill(alias);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText('Saved "Widget Town".')).toBeVisible();
  await expect(page.locator("li", { hasText: "Widget Town" }).first()).toContainText(`aka ${alias}`);
});
