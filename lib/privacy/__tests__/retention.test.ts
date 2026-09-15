import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETENTION,
  expiryCutoff,
  isExpired,
  partitionByRetention,
  retentionRule,
} from "@/lib/privacy/retention";

/**
 * The retention policy.
 *
 * The behaviour that matters most is the NEGATIVE one: user-controlled
 * categories must never be reported as expired, however old they are.
 * That is what stops a future policy run from quietly deleting an
 * elderly person's photographs of their family.
 */

const NOW = new Date("2026-09-15T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function ago(days: number): Date {
  return new Date(NOW.getTime() - days * DAY);
}

describe("policy shape", () => {
  it("documents a purpose and a rationale for every category", () => {
    for (const rule of DEFAULT_RETENTION) {
      expect(rule.purpose.length).toBeGreaterThan(10);
      expect(rule.rationale.length).toBeGreaterThan(20);
    }
  });

  it("covers each category exactly once", () => {
    const names = DEFAULT_RETENTION.map((r) => r.category);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives user- and consent-controlled categories no clock", () => {
    for (const rule of DEFAULT_RETENTION) {
      if (rule.control === "USER" || rule.control === "CONSENT") {
        expect(rule.days).toBeNull();
      } else {
        expect(rule.days).toBeGreaterThan(0);
      }
    }
  });

  it("keeps audit events longer than the activity they describe", () => {
    const audit = retentionRule("AUDIT_EVENT");
    const sessions = retentionRule("GAME_SESSION");
    expect(audit?.days ?? 0).toBeGreaterThan(sessions?.days ?? 0);
  });
});

describe("eligible data", () => {
  it("does not expire a recent game session", () => {
    expect(
      isExpired({ category: "GAME_SESSION", createdAt: ago(10), now: NOW }),
    ).toBe(false);
  });

  it("does not expire a session one day inside the window", () => {
    expect(
      isExpired({ category: "GAME_SESSION", createdAt: ago(729), now: NOW }),
    ).toBe(false);
  });
});

describe("expired data", () => {
  it("expires a game session past two years", () => {
    expect(
      isExpired({ category: "GAME_SESSION", createdAt: ago(731), now: NOW }),
    ).toBe(true);
  });

  it("expires a reminder log past a year", () => {
    expect(
      isExpired({ category: "REMINDER_LOG", createdAt: ago(400), now: NOW }),
    ).toBe(true);
  });

  it("expires an alert past six months", () => {
    expect(isExpired({ category: "ALERT", createdAt: ago(200), now: NOW })).toBe(
      true,
    );
  });
});

describe("protected data", () => {
  it("never expires personal memories, however old", () => {
    expect(
      isExpired({ category: "PERSONAL_MEMORY", createdAt: ago(5000), now: NOW }),
    ).toBe(false);
  });

  it("never expires caregiver notes", () => {
    expect(
      isExpired({ category: "CAREGIVER_NOTE", createdAt: ago(5000), now: NOW }),
    ).toBe(false);
  });

  it("never expires the research representation on a clock", () => {
    // It has no clock because it is derived, not stored. Consent is the
    // control, and consent has no expiry date of its own.
    expect(
      isExpired({
        category: "RESEARCH_REPRESENTATION",
        createdAt: ago(5000),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("never expires an unknown category", () => {
    // Fail closed: data nobody wrote a rule for is not deleted.
    expect(
      isExpired({ category: "SOMETHING_NEW", createdAt: ago(9999), now: NOW }),
    ).toBe(false);
  });
});

describe("cutoffs and partitioning", () => {
  it("computes a cutoff for a policy-controlled category", () => {
    const cutoff = expiryCutoff("ALERT", NOW);
    expect(cutoff).toEqual(ago(180));
  });

  it("returns no cutoff for a user-controlled category", () => {
    expect(expiryCutoff("PERSONAL_MEMORY", NOW)).toBeNull();
  });

  it("splits records into expired and retained", () => {
    const records = [
      { id: "old", createdAt: ago(900) },
      { id: "new", createdAt: ago(5) },
      { id: "edge", createdAt: ago(731) },
    ];

    const { expired, retained } = partitionByRetention({
      category: "GAME_SESSION",
      records,
      now: NOW,
    });

    expect(expired.map((r) => r.id).sort()).toEqual(["edge", "old"]);
    expect(retained.map((r) => r.id)).toEqual(["new"]);
  });

  it("retains everything for a user-controlled category", () => {
    const { expired, retained } = partitionByRetention({
      category: "PERSONAL_MEMORY",
      records: [{ id: "ancient", createdAt: ago(4000) }],
      now: NOW,
    });
    expect(expired).toHaveLength(0);
    expect(retained).toHaveLength(1);
  });
});
