import { describe, expect, it } from "vitest";

import {
  buildExportRecord,
  containsForbiddenField,
  durationBucket,
  monthBucket,
  researchExportRecordSchema,
  validateExport,
  type ExportableSession,
} from "@/lib/research-data/export";

/**
 * The export REPRESENTATION — the privacy boundary itself.
 *
 * These are the tests that would fail if somebody added a field to the
 * research record without thinking about what it discloses. They are
 * deliberately blunt about it.
 */

function session(overrides: Partial<ExportableSession> = {}): ExportableSession {
  return {
    participantId: "a".repeat(32),
    gameId: "remember-objects",
    domain: "SHORT_TERM_MEMORY",
    difficulty: "EASY",
    roundsTotal: 4,
    roundsCompleted: 4,
    correctCount: 3,
    incorrectCount: 1,
    hints: 0,
    durationMs: 45_000,
    occurredAt: new Date("2026-09-14T06:30:00.000Z"),
    consentVersion: "research-consent-v1",
    ...overrides,
  };
}

describe("data minimisation — buckets", () => {
  it("buckets durations rather than exporting exact times", () => {
    expect(durationBucket(10_000)).toBe("<30s");
    expect(durationBucket(45_000)).toBe("30-60s");
    expect(durationBucket(90_000)).toBe("1-2m");
    expect(durationBucket(200_000)).toBe("2-5m");
    expect(durationBucket(600_000)).toBe("5m+");
  });

  it("puts bucket boundaries on the lower bucket", () => {
    expect(durationBucket(30_000)).toBe("30-60s");
    expect(durationBucket(60_000)).toBe("1-2m");
    expect(durationBucket(120_000)).toBe("2-5m");
    expect(durationBucket(300_000)).toBe("5m+");
  });

  it("handles a nonsensical negative duration without throwing", () => {
    expect(durationBucket(-5)).toBe("<30s");
  });

  it("reduces a timestamp to a calendar month", () => {
    expect(monthBucket(new Date("2026-09-14T06:30:00.000Z"))).toBe("2026-09");
    expect(monthBucket(new Date("2026-01-02T23:59:59.000Z"))).toBe("2026-01");
  });

  it("never exposes a day or an hour", () => {
    const bucket = monthBucket(new Date("2026-09-14T06:30:00.000Z"));
    expect(bucket).not.toContain("14");
    expect(bucket).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("record construction", () => {
  it("produces exactly the permitted fields and no others", () => {
    const record = buildExportRecord(session());
    expect(Object.keys(record).sort()).toEqual(
      [
        "accuracy",
        "anonymousParticipantId",
        "completion",
        "consentVersion",
        "difficulty",
        "domain",
        "gameType",
        "hintRate",
        "sessionDurationBucket",
        "timestampBucket",
      ].sort(),
    );
  });

  it("carries no forbidden field", () => {
    expect(containsForbiddenField(buildExportRecord(session()))).toBeNull();
  });

  it("computes accuracy from answered items", () => {
    expect(buildExportRecord(session()).accuracy).toBe(0.75);
  });

  it("computes completion as a fraction of rounds", () => {
    expect(
      buildExportRecord(session({ roundsTotal: 4, roundsCompleted: 2 }))
        .completion,
    ).toBe(0.5);
  });

  it("does not divide by zero on an empty session", () => {
    const record = buildExportRecord(
      session({ roundsTotal: 0, roundsCompleted: 0, correctCount: 0, incorrectCount: 0 }),
    );
    expect(record.accuracy).toBe(0);
    expect(record.completion).toBe(0);
    expect(record.hintRate).toBe(0);
  });

  it("clamps a completion above 1", () => {
    expect(
      buildExportRecord(session({ roundsTotal: 2, roundsCompleted: 5 })).completion,
    ).toBe(1);
  });

  it("clamps a hint rate above 1", () => {
    expect(buildExportRecord(session({ hints: 99 })).hintRate).toBe(1);
  });
});

describe("validation", () => {
  it("accepts a well-formed record", () => {
    const { valid, rejected } = validateExport([buildExportRecord(session())]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("REJECTS a record carrying a name", () => {
    const tainted = { ...buildExportRecord(session()), name: "Supriya" };
    const { valid, rejected } = validateExport([tainted]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("REJECTS a record carrying a userId", () => {
    const tainted = { ...buildExportRecord(session()), userId: "cmu123" };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("REJECTS a record carrying an exact timestamp", () => {
    const tainted = {
      ...buildExportRecord(session()),
      completedAt: "2026-09-14T06:30:00.000Z",
    };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("REJECTS a record carrying a caregiver identifier", () => {
    const tainted = { ...buildExportRecord(session()), caregiverId: "cg-1" };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("REJECTS a record carrying memory content", () => {
    const tainted = {
      ...buildExportRecord(session()),
      imagePath: "1234.jpg",
      description: "Grandson's wedding",
    };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("rejects a participant id that is not an HMAC digest", () => {
    const tainted = {
      ...buildExportRecord(session()),
      anonymousParticipantId: "cmu1lc6hd0002zd60kqe2q5vo",
    };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("rejects an out-of-range accuracy", () => {
    const tainted = { ...buildExportRecord(session()), accuracy: 1.5 };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("rejects an unbucketed duration", () => {
    const tainted = {
      ...buildExportRecord(session()),
      sessionDurationBucket: "45231ms",
    };
    expect(validateExport([tainted]).valid).toHaveLength(0);
  });

  it("counts rejects rather than silently halving the dataset", () => {
    const good = buildExportRecord(session());
    const { valid, rejected } = validateExport([
      good,
      { ...good, email: "a@b.c" },
      good,
      null,
    ]);
    expect(valid).toHaveLength(2);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason.length).toBeGreaterThan(0);
  });

  it("names the offending field in the rejection reason", () => {
    const { rejected } = validateExport([
      { ...buildExportRecord(session()), phone: "+911234567890" },
    ]);
    expect(rejected[0].reason).toContain("phone");
  });
});

describe("schema is strict", () => {
  it("refuses unknown keys outright", () => {
    const parsed = researchExportRecordSchema.safeParse({
      ...buildExportRecord(session()),
      extra: 1,
    });
    expect(parsed.success).toBe(false);
  });
});
