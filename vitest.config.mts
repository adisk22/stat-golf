import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["lib/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 20_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
