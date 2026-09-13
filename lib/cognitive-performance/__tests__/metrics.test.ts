import { describe, expect, it } from "vitest";

import {
  clamp,
  consistencyOf,
  hintPenalty,
  masteryScore,
  mean,
  sessionIndicator,
  slopeOf,
  speedAdjustment,
  stdev,
  stepDifficulty,
  trendOf,
  weightedMean,
} from "@/lib/cognitive-performance/metrics";
import { DIFFICULTY_ORDER } from "@/lib/cognitive-performance/config";
import { sample } from "./_helpers";

describe("basic maths", () => {
  it("clamps to a range", () => {
    expect(clamp(120)).toBe(100);
    expect(clamp(-5)).toBe(0);
    expect(clamp(50)).toBe(50);
  });

  it("means and stdev", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(stdev([5, 5, 5])).toBe(0);
    expect(stdev([90, 88, 92, 89, 91])).toBeCloseTo(1.414, 2);
  });

  it("weights recent values more heavily", () => {
    // newest (last) is 100; weighted mean must exceed the plain mean.
    const values = [40, 60, 100];
    expect(weightedMean(values)).toBeGreaterThan(mean(values));
    // weights 1,2,3 → (40 + 120 + 300)/6 = 76.67
    expect(weightedMean(values)).toBeCloseTo(76.67, 1);
  });
});

describe("session indicator (banded by difficulty)", () => {
  it("places perfect scores at the top of each band", () => {
    expect(sessionIndicator(sample({ score: 100, difficulty: "EASY" }))).toBe(70);
    expect(sessionIndicator(sample({ score: 100, difficulty: "MEDIUM" }))).toBe(85);
    expect(sessionIndicator(sample({ score: 100, difficulty: "HARD" }))).toBe(100);
  });

  it("rewards the same accuracy more at a harder level", () => {
    const easy = sessionIndicator(sample({ score: 80, difficulty: "EASY" }));
    const hard = sessionIndicator(sample({ score: 80, difficulty: "HARD" }));
    expect(hard).toBeGreaterThan(easy);
  });

  it("mastery is the raw accuracy at the level played", () => {
    expect(masteryScore(sample({ score: 100, difficulty: "EASY" }))).toBe(100);
    expect(masteryScore(sample({ score: 40, difficulty: "HARD" }))).toBe(40);
  });
});

describe("bounded modifiers", () => {
  it("missing timing yields no speed adjustment", () => {
    expect(speedAdjustment(sample({ score: 80, avgResponseTimeMs: 0 }))).toBe(0);
  });

  it("comfortable timing yields no speed adjustment", () => {
    // ATTENTION reference 4000 ± 2500 → 5000 is inside the band.
    const s = sample({
      score: 80,
      domain: "ATTENTION",
      avgResponseTimeMs: 5000,
    });
    expect(speedAdjustment(s)).toBe(0);
  });

  it("very fast nudges up and very slow nudges down, both small", () => {
    const fast = speedAdjustment(
      sample({ score: 80, domain: "ATTENTION", avgResponseTimeMs: 500 }),
    );
    const slow = speedAdjustment(
      sample({ score: 80, domain: "ATTENTION", avgResponseTimeMs: 60000 }),
    );
    expect(fast).toBeGreaterThan(0);
    expect(slow).toBeLessThan(0);
    expect(Math.abs(fast)).toBeLessThanOrEqual(4);
    expect(Math.abs(slow)).toBeLessThanOrEqual(4);
  });

  it("hints apply a bounded penalty", () => {
    const none = hintPenalty(sample({ score: 80, hints: 0, roundsTotal: 5 }));
    const many = hintPenalty(sample({ score: 80, hints: 5, roundsTotal: 5 }));
    expect(none).toBe(0);
    expect(many).toBeGreaterThan(0);
    expect(many).toBeLessThanOrEqual(8);
  });
});

describe("consistency", () => {
  it("is null with fewer than two scores", () => {
    expect(consistencyOf([])).toBeNull();
    expect(consistencyOf([90])).toBeNull();
  });

  it("is high for steady scores and low for swinging ones", () => {
    const steady = consistencyOf([90, 88, 92, 89, 91])!;
    const swinging = consistencyOf([95, 52, 87, 43, 91])!;
    expect(steady).toBeGreaterThan(90);
    expect(swinging).toBeLessThan(60);
    expect(steady).toBeGreaterThan(swinging);
  });
});

describe("trend", () => {
  it("is stable with too few sessions", () => {
    expect(trendOf([60, 90])).toBe("stable");
  });

  it("detects improving, declining and stable runs", () => {
    expect(trendOf([65, 70, 75, 80])).toBe("improving");
    expect(trendOf([85, 78, 70, 60])).toBe("declining");
    expect(trendOf([80, 82, 79, 81])).toBe("stable");
  });

  it("treats a slight drift as stable, not declining", () => {
    // 85→81 over four sessions is a gentle slope, inside the band.
    expect(trendOf([85, 83, 82, 81])).toBe("stable");
    expect(slopeOf([85, 83, 82, 81])).toBeGreaterThan(-2);
  });
});

describe("difficulty stepping", () => {
  it("moves one level and never past the ends", () => {
    expect(stepDifficulty("EASY", "up", DIFFICULTY_ORDER)).toBe("MEDIUM");
    expect(stepDifficulty("MEDIUM", "up", DIFFICULTY_ORDER)).toBe("HARD");
    expect(stepDifficulty("HARD", "up", DIFFICULTY_ORDER)).toBe("HARD");
    expect(stepDifficulty("EASY", "down", DIFFICULTY_ORDER)).toBe("EASY");
    expect(stepDifficulty("HARD", "down", DIFFICULTY_ORDER)).toBe("MEDIUM");
  });
});
