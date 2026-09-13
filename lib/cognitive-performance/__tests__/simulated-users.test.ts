import { describe, expect, it } from "vitest";
import type { Difficulty } from "@prisma/client";

import { computeDomainPerformance } from "@/lib/cognitive-performance/performance";
import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import { runOfScores } from "./_helpers";

/**
 * End-to-end scenarios: raw score histories run through the real
 * aggregation and the real adaptive rule, exactly as the app does.
 * These are the acceptance scenarios from the Phase 2 brief.
 */
function nextDifficulty(scores: number[], playedAt: Difficulty) {
  const perf = computeDomainPerformance(
    "SHORT_TERM_MEMORY",
    runOfScores(scores, { difficulty: playedAt }),
  );
  return { perf, rec: recommendDifficulty(perf) };
}

describe("User A — strong and steady", () => {
  it("steps up gradually from easy", () => {
    const { rec } = nextDifficulty([90, 92, 88, 94, 91], "EASY");
    expect(rec.direction).toBe("up");
    expect(rec.difficulty).toBe("MEDIUM");
  });

  it("keeps climbing one level at a time, never skipping", () => {
    const { rec } = nextDifficulty([90, 92, 88, 94, 91], "MEDIUM");
    expect(rec.difficulty).toBe("HARD");
  });
});

describe("User B — struggling", () => {
  it("eases down a level", () => {
    const { rec } = nextDifficulty([50, 54, 48, 57, 51], "MEDIUM");
    expect(rec.direction).toBe("down");
    expect(rec.difficulty).toBe("EASY");
  });

  it("cannot fall below the gentlest level", () => {
    const { rec } = nextDifficulty([50, 54, 48, 57, 51], "EASY");
    expect(rec.difficulty).toBe("EASY");
    expect(rec.reason).toBe("atMinimum");
  });
});

describe("User C — improving", () => {
  it("does not drop, and reads as improving, while still climbing", () => {
    const { perf, rec } = nextDifficulty([55, 61, 68, 74, 81], "EASY");
    expect(perf.trend).toBe("improving");
    expect(rec.direction).not.toBe("down");
    expect(["MEDIUM", "EASY"]).toContain(rec.difficulty);
  });

  it("steps up once the improving run reaches the threshold", () => {
    const { rec } = nextDifficulty([61, 68, 74, 81, 88], "EASY");
    expect(rec.direction).toBe("up");
    expect(rec.difficulty).toBe("MEDIUM");
    expect(rec.reason).toBe("steppedUpImproving");
  });
});

describe("User D — unstable", () => {
  it("is treated conservatively: no step up despite good days", () => {
    const { perf, rec } = nextDifficulty([95, 45, 88, 50, 92], "MEDIUM");
    expect(rec.direction).toBe("hold");
    expect(rec.difficulty).toBe("MEDIUM");
    expect(perf.confidence).toBe("LOW");
  });
});

describe("User E — brand new", () => {
  it("starts easy with no history", () => {
    const { rec } = nextDifficulty([], "EASY");
    expect(rec.difficulty).toBe("EASY");
    expect(rec.reason).toBe("coldStart");
  });

  it("stays in cold start until enough sessions exist", () => {
    const { perf, rec } = nextDifficulty([95, 96], "EASY");
    expect(perf.coldStart).toBe(true);
    expect(rec.reason).toBe("coldStart");
  });
});
