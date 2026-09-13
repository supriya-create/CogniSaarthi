import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests cover the pure cognitive-performance engine only — no React,
 * no database. The `@/` alias mirrors tsconfig so test imports match
 * app imports exactly.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Let server-guarded modules import under the Node test runner.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // DB-backed authorization tests share the dev database; run serially.
    fileParallelism: false,
  },
});
