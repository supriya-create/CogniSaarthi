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
