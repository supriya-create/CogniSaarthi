import { describe, expect, it } from "vitest";
import type { Difficulty } from "@prisma/client";

import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import type {
  DomainPerformance,
  Trend,
} from "@/lib/cognitive-performance/types";

/** Build a warm DomainPerformance directly, to pin exact boundaries. */
function perf(
  over: Partial<DomainPerformance> & { mastery: number },
): DomainPerformance {
  return {
    domain: "SHORT_TERM_MEMORY",
    sessionCount: over.sessionCount ?? 5,
    coldStart: false,
    indicator: over.indicator ?? over.mastery,
    mastery: over.mastery,
    consistency: over.consistency ?? 90,
    trend: (over.trend ?? "stable") as Trend,
    confidence: over.confidence ?? "MEDIUM",
    currentDifficulty: (over.currentDifficulty ?? "MEDIUM") as Difficulty,
  };
}

describe("cold start", () => {
  it("holds at the starting level with no data", () => {
    const rec = recommendDifficulty({
      domain: "ATTENTION",
      sessionCount: 0,
      coldStart: true,
      indicator: null,
      mastery: null,
      consistency: null,
      trend: "stable",
      confidence: "LOW",
      currentDifficulty: "EASY",
    });
    expect(rec.difficulty).toBe("EASY");
    expect(rec.direction).toBe("hold");
    expect(rec.reason).toBe("coldStart");
  });
});

describe("stepping up", () => {
  it("steps up on clear, steady mastery", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 90, consistency: 90, currentDifficulty: "EASY" }),
    );
    expect(rec.difficulty).toBe("MEDIUM");
    expect(rec.direction).toBe("up");
    expect(rec.reason).toBe("steppedUpStrong");
  });

  it("steps up only one level at a time", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 95, consistency: 95, currentDifficulty: "EASY" }),
    );
    expect(rec.difficulty).toBe("MEDIUM"); // never EASY→HARD
  });

  it("does NOT step up when scores are unstable", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 90, consistency: 40, currentDifficulty: "EASY" }),
    );
    expect(rec.direction).toBe("hold");
    expect(rec.reason).toBe("heldUnstable");
  });

  it("does NOT step up when declining even with a high average", () => {
    const rec = recommendDifficulty(
      perf({
        mastery: 88,
        consistency: 90,
        trend: "declining",
        currentDifficulty: "EASY",
      }),
    );
    expect(rec.direction).toBe("hold");
  });

  it("steps up cautiously when improving toward mastery", () => {
    const rec = recommendDifficulty(
      perf({
        mastery: 80,
        consistency: 80,
        trend: "improving",
        currentDifficulty: "EASY",
      }),
    );
    expect(rec.direction).toBe("up");
    expect(rec.reason).toBe("steppedUpImproving");
  });

  it("holds at the ceiling", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 95, consistency: 95, currentDifficulty: "HARD" }),
    );
    expect(rec.difficulty).toBe("HARD");
    expect(rec.direction).toBe("hold");
    expect(rec.reason).toBe("atMaximum");
  });
});

describe("stepping down", () => {
  it("steps down when struggling", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 50, currentDifficulty: "HARD" }),
    );
    expect(rec.difficulty).toBe("MEDIUM");
    expect(rec.direction).toBe("down");
    expect(rec.reason).toBe("steppedDown");
  });

  it("holds at the floor", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 40, currentDifficulty: "EASY" }),
    );
    expect(rec.difficulty).toBe("EASY");
    expect(rec.direction).toBe("hold");
    expect(rec.reason).toBe("atMinimum");
  });
});

describe("boundaries", () => {
  it("exactly 85 with good consistency steps up", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 85, consistency: 65, currentDifficulty: "EASY" }),
    );
    expect(rec.direction).toBe("up");
  });

  it("exactly 65 holds (not a step down)", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 65, currentDifficulty: "MEDIUM" }),
    );
    expect(rec.direction).toBe("hold");
    expect(rec.difficulty).toBe("MEDIUM");
  });

  it("just below 65 steps down", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 64, currentDifficulty: "MEDIUM" }),
    );
    expect(rec.direction).toBe("down");
  });

  it("the mid band (65–84, stable) holds", () => {
    const rec = recommendDifficulty(
      perf({ mastery: 75, trend: "stable", currentDifficulty: "MEDIUM" }),
    );
    expect(rec.direction).toBe("hold");
    expect(rec.reason).toBe("held");
  });
});
