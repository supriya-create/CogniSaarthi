import { describe, expect, it } from "vitest";

import {
  computeDomainPerformance,
  confidenceFrom,
} from "@/lib/cognitive-performance/performance";
import { runOfScores, sample } from "./_helpers";

describe("computeDomainPerformance", () => {
  it("reports cold start below the minimum session count", () => {
    const perf = computeDomainPerformance(
      "SHORT_TERM_MEMORY",
      runOfScores([80, 90]),
    );
    expect(perf.coldStart).toBe(true);
    expect(perf.indicator).toBeNull();
    expect(perf.mastery).toBeNull();
    expect(perf.confidence).toBe("LOW");
    expect(perf.sessionCount).toBe(2);
  });

  it("computes indicator, mastery, consistency and trend once warm", () => {
    const perf = computeDomainPerformance(
      "SHORT_TERM_MEMORY",
      runOfScores([70, 75, 80, 85, 90]),
    );
    expect(perf.coldStart).toBe(false);
    expect(perf.mastery).not.toBeNull();
    expect(perf.indicator).not.toBeNull();
    expect(perf.consistency).not.toBeNull();
    expect(perf.trend).toBe("improving");
  });

  it("only considers the requested domain", () => {
    const mixed = [
      ...runOfScores([30, 30, 30], { domain: "ATTENTION" }),
      ...runOfScores([90, 90, 90], { domain: "SHORT_TERM_MEMORY" }),
    ];
    const memory = computeDomainPerformance("SHORT_TERM_MEMORY", mixed);
    expect(memory.sessionCount).toBe(3);
    expect(memory.mastery).toBe(90);
  });

  it("keeps only the most recent sessions in the window", () => {
    // Nine sessions; the window is 5, and the newest are the low ones,
    // so mastery should reflect the recent poor run, not the old highs.
    const perf = computeDomainPerformance("ATTENTION", [
      ...runOfScores([95, 95, 95, 95], { domain: "ATTENTION" }),
      ...runOfScores([40, 40, 40, 40, 40], { domain: "ATTENTION" }),
    ]);
    expect(perf.sessionCount).toBe(5);
    expect(perf.mastery).toBe(40);
  });

  it("tracks the current difficulty from the most recent session", () => {
    const perf = computeDomainPerformance("WORKING_MEMORY", [
      sample({ score: 90, difficulty: "EASY", domain: "WORKING_MEMORY" }),
      sample({ score: 90, difficulty: "MEDIUM", domain: "WORKING_MEMORY" }),
      sample({ score: 90, difficulty: "HARD", domain: "WORKING_MEMORY" }),
    ]);
    expect(perf.currentDifficulty).toBe("HARD");
  });
});

describe("confidence", () => {
  it("is LOW in cold start", () => {
    expect(confidenceFrom(2, 95)).toBe("LOW");
  });

  it("is MEDIUM with a modest, steady history", () => {
    expect(confidenceFrom(5, 90)).toBe("MEDIUM");
  });

  it("is HIGH with a long, steady history", () => {
    expect(confidenceFrom(9, 90)).toBe("HIGH");
  });

  it("is dragged down one level when scores are shaky", () => {
    expect(confidenceFrom(9, 30)).toBe("MEDIUM");
    expect(confidenceFrom(5, 30)).toBe("LOW");
  });
});
