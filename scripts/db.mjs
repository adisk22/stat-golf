// Database commands for the hosted Supabase project (no Docker needed) and the
// optional local stack. Loads .env.local automatically (see package.json scripts).
//
//   pnpm db:push            link the CLI to SUPABASE_PROJECT_ID and push migrations
//   pnpm db:push --seed     ...and run supabase/seed.sql (fake demo data)
//   pnpm db:reset           WIPE + re-migrate + re-seed. Refuses unless SUPABASE_ENV=dev.
//   pnpm db:reset --local   same, against the optional local Docker stack
//
// Needs: SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD, and SUPABASE_ACCESS_TOKEN
// (https://supabase.com/dashboard/account/tokens) or a prior `supabase login`.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const [command, ...flags] = process.argv.slice(2);
const local = flags.includes("--local");

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function supabase(...args) {
  const res = spawnSync("pnpm", ["exec", "supabase", ...args], { stdio: "inherit" });
  // Print only the subcommand, never the arguments (they include the password).
  if (res.status !== 0) fail(`supabase ${args.slice(0, 2).join(" ")} failed`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) fail(`${name} is not set (add it to .env.local or the CI secrets).`);
  return v;
}

function link() {
  const ref = requireEnv("SUPABASE_PROJECT_ID");
  requireEnv("SUPABASE_DB_PASSWORD"); // read by the CLI from the environment
  supabase("link", "--project-ref", ref);
  const linked = existsSync("supabase/.temp/project-ref")
    ? readFileSync("supabase/.temp/project-ref", "utf8").trim()
    : ref;
  if (linked !== ref) fail(`CLI is linked to ${linked}, expected ${ref}.`);
  return ref;
}

switch (command) {
  case "push": {
    const ref = link();
    console.log(`Pushing migrations to ${ref}…`);
    // CLI v3 targets the local database by default; --remote picks the hosted project.
    supabase(
      "db", "push", `--remote=${ref}`, "--password", process.env.SUPABASE_DB_PASSWORD, "--yes",
      ...(flags.includes("--seed") ? ["--include-seed"] : []),
    );
    break;
  }
  case "reset": {
    if (process.env.SUPABASE_ENV !== "dev") {
      fail("db:reset wipes the database. It only runs when SUPABASE_ENV=dev.");
    }
    if (local) {
      supabase("db", "reset");
      break;
    }
    const devRef = requireEnv("SUPABASE_DEV_PROJECT_ID");
    const target = requireEnv("SUPABASE_PROJECT_ID");
    if (target !== devRef) {
      fail(`Refusing to reset ${target}: it is not the dev project (${devRef}).`);
    }
    const ref = link();
    console.log(`Resetting dev project ${ref}…`);
    supabase("db", "reset", `--remote=${ref}`, "--password", process.env.SUPABASE_DB_PASSWORD, "--yes");
    break;
  }
  default:
    fail("Usage: node scripts/db.mjs <push [--seed] | reset [--local]>");
}
