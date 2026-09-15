import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MissingPseudonymSecretError,
  participantId,
  participantIdMatches,
  pseudonymSecretConfigured,
} from "@/lib/privacy/pseudonymise";

/**
 * Pseudonymous identifiers, and the fact that the exporter is not
 * reachable over HTTP.
 */

const REAL_SECRET = process.env.RESEARCH_EXPORT_SECRET;

afterEach(() => {
  process.env.RESEARCH_EXPORT_SECRET = REAL_SECRET;
});

describe("participant ids", () => {
  it("is a 32-character hex digest, not an application id", () => {
    const pid = participantId("cmu1lc6hd0002zd60kqe2q5vo");
    expect(pid).toMatch(/^[0-9a-f]{32}$/);
    expect(pid).not.toContain("cmu1");
  });

  it("is deterministic for the same person", () => {
    expect(participantId("user-1")).toBe(participantId("user-1"));
  });

  it("differs between people", () => {
    expect(participantId("user-1")).not.toBe(participantId("user-2"));
  });

  it("differs between purposes, so two exports cannot be joined", () => {
    expect(participantId("user-1", "purpose-a")).not.toBe(
      participantId("user-1", "purpose-b"),
    );
  });

  it("confirms a match for support requests", () => {
    const pid = participantId("user-1");
    expect(participantIdMatches(pid, "user-1")).toBe(true);
    expect(participantIdMatches(pid, "user-2")).toBe(false);
  });

  it("rejects a candidate of the wrong length without throwing", () => {
    expect(participantIdMatches("abc", "user-1")).toBe(false);
  });
});

describe("the secret is required", () => {
  it("reports when it is configured", () => {
    expect(pseudonymSecretConfigured()).toBe(true);
  });

  it("REFUSES to derive an id when the secret is missing", () => {
    delete process.env.RESEARCH_EXPORT_SECRET;
    expect(pseudonymSecretConfigured()).toBe(false);
    expect(() => participantId("user-1")).toThrow(MissingPseudonymSecretError);
  });

  it("REFUSES a short secret rather than producing a weak id", () => {
    process.env.RESEARCH_EXPORT_SECRET = "short";
    expect(pseudonymSecretConfigured()).toBe(false);
    expect(() => participantId("user-1")).toThrow(MissingPseudonymSecretError);
  });

  it("is separate from AUTH_SECRET", () => {
    // Key separation: rotating session signing must not re-pseudonymise
    // a cohort, and a leaked session secret must not hand over the
    // identity mapping.
    expect(process.env.RESEARCH_EXPORT_SECRET).not.toBe(process.env.AUTH_SECRET);
  });
});

describe("research export is not exposed over HTTP", () => {
  const apiRoot = path.join(process.cwd(), "app", "api");

  it("has no /api/research route", () => {
    expect(existsSync(path.join(apiRoot, "research"))).toBe(false);
  });

  it("has no route whose path mentions export", () => {
    // There is no research-admin role yet, and an export endpoint whose
    // only protection is an unguessable URL is not protected. The
    // service exists and is tested; a route waits for a real role.
    const found: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (/research|export/i.test(entry.name)) found.push(full);
          walk(full);
        }
      }
    }

    walk(apiRoot);
    expect(found).toEqual([]);
  });
});
