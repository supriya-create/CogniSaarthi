import { readFileSync } from "node:fs";

/**
 * Load .env into process.env for tests that touch the database
 * (the authorization tests). Pure-logic tests don't need this, but
 * loading it unconditionally is harmless and keeps setup simple.
 */
try {
  const env = readFileSync(new URL(".env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // No .env — pure tests still run.
}

/**
 * Phase 7: the research exporter refuses to run without a dedicated
 * pseudonymisation secret, on purpose — exporting under a missing or
 * guessable key would produce ids that are not really pseudonymous.
 * Tests need one, and it must NOT be the real deployment's, so a
 * throwaway is set here when .env has not supplied one.
 */
if (!process.env.RESEARCH_EXPORT_SECRET) {
  process.env.RESEARCH_EXPORT_SECRET =
    "test-only-research-export-secret-not-for-deployment";
}
