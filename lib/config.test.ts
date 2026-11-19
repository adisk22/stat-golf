import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_STROKES_PER_HOLE, ROLLOVER_TIMEZONE } from "./config";

/** The SQL side keeps copies of a few constants; the latest migration defining each must match. */
function latestSqlConstant(fn: string): string {
  const dir = join(__dirname, "..", "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let value: string | undefined;
  const re = new RegExp(`function app\\.${fn}\\(\\)[\\s\\S]*?\\$\\$\\s*select\\s+'?([^';\\s]+)'?`, "g");
  for (const f of files) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(re)) value = m[1];
  }
  if (!value) throw new Error(`app.${fn}() not found in migrations`);
  return value;
}

describe("config is in sync with SQL", () => {
  it("rollover timezone", () => {
    expect(latestSqlConstant("rollover_timezone")).toBe(ROLLOVER_TIMEZONE);
  });
  it("max strokes per hole", () => {
    expect(Number(latestSqlConstant("max_strokes_per_hole"))).toBe(MAX_STROKES_PER_HOLE);
  });
});
