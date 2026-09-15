import { describe, expect, it } from "vitest";
import type { CognitiveDomain, Difficulty } from "@prisma/client";

import { computeDomainPerformance } from "@/lib/cognitive-performance/performance";
import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import { buildAllDomainProfiles, computeActivityRoutine } from "@/lib/intelligence/longitudinal";
import { buildDailyPlan } from "@/lib/intelligence/daily-plan";
import { rankActivities } from "@/lib/intelligence/recommendations";
import {
  explainRecommendationForCaregiver,
  explainRoutine,
  explainTrend,
  elderProgressKey,
} from "@/lib/intelligence/explanations";
import { aiAvailability } from "@/lib/intelligence/ai";
import { isSafeCopy } from "@/lib/intelligence/safety";
import { NOW, series } from "@/lib/intelligence/__tests__/_helpers";

/**
 * SIMULATED USERS
 * -----------------------------------------------------------------
 * Whole-journey checks: real histories in, a real plan and real
 * explanations out. These are the tests that would catch the engine
 * behaving reasonably in isolation but badly for an actual person —
 * drilling one weakness daily, or scolding somebody for taking a week
 * off.
 */

const GAMES = [
  { gameId: "remember-objects", domain: "SHORT_TERM_MEMORY" as CognitiveDomain },
  { gameId: "find-different", domain: "ATTENTION" as CognitiveDomain },
  { gameId: "remember-sequence", domain: "WORKING_MEMORY" as CognitiveDomain },
  { gameId: "story-recall", domain: "LANGUAGE" as CognitiveDomain },
];

function plan(samples: PerformanceSample[], overrides = {}) {
  const profiles = buildAllDomainProfiles(samples, NOW);
  const routine = computeActivityRoutine(samples, NOW);
  const difficultyByDomain = new Map<CognitiveDomain, Difficulty>(
    GAMES.map((g) => [
      g.domain,
      recommendDifficulty(computeDomainPerformance(g.domain, samples)).difficulty,
    ]),
  );
  const context = {
    profiles,
    routine,
    availableGames: GAMES,
    recentGameIds: [] as string[],
    completedTodayGameIds: [] as string[],
    difficultyByDomain,
    ...overrides,
  };
  return {
    profiles,
    routine,
    ranked: rankActivities(context),
    daily: buildDailyPlan({ ...context, completedToday: 0, recentSamples: samples }),
  };
}

/** No generated sentence may ever make a health claim. */
function assertAllCopySafe(result: ReturnType<typeof plan>) {
  expect(isSafeCopy(explainRoutine(result.routine))).toBe(true);
  for (const profile of result.profiles) {
    expect(isSafeCopy(explainTrend(profile))).toBe(true);
  }
  for (const recommendation of result.ranked) {
    expect(
      isSafeCopy(explainRecommendationForCaregiver(recommendation, "Activity")),
    ).toBe(true);
  }
}

describe("User A — cold start", () => {
  const result = plan(series("SHORT_TERM_MEMORY", [60, 65], { startDaysAgo: 2 }));

  it("admits it does not know them yet", () => {
    const memory = result.profiles.find((p) => p.domain === "SHORT_TERM_MEMORY")!;
    expect(memory.baseline.state).toBe("NOT_ESTABLISHED");
    expect(memory.trend.classification).toBe("INSUFFICIENT_DATA");
    expect(memory.confidence).toBe("LOW");
  });

  it("still gives a simple, usable suggestion", () => {
    expect(result.daily.activities.length).toBeGreaterThan(0);
    assertAllCopySafe(result);
  });
});

describe("User B — consistent improvement", () => {
  const samples = series("ATTENTION", [70, 76, 82, 88, 92, 95], {
    startDaysAgo: 6,
  });
  const result = plan(samples);

  it("is recognised as improving with real confidence", () => {
    const attention = result.profiles.find((p) => p.domain === "ATTENTION")!;
    expect(attention.shortTrend).toBe("improving");
    expect(attention.confidence).not.toBe("LOW");
  });

  it("is offered a little more challenge, via the Phase 2 engine", () => {
    const performance = computeDomainPerformance("ATTENTION", samples);
    const recommendation = recommendDifficulty(performance);
    expect(recommendation.direction).toBe("up");
    expect(recommendation.difficulty).toBe("HARD");
  });
});

describe("User C — memory consistently weaker", () => {
  const result = plan([
    ...series("SHORT_TERM_MEMORY", [38, 42, 40, 39, 41], { startDaysAgo: 5 }),
    ...series("ATTENTION", [85, 88, 86, 87, 89], { startDaysAgo: 5 }),
  ]);

  it("leads with memory practice", () => {
    expect(result.ranked[0].domain).toBe("SHORT_TERM_MEMORY");
    expect(result.ranked[0].reasons).toContain("needsPractice");
  });

  it("eases the level rather than pushing", () => {
    const memory = result.ranked[0];
    expect(memory.difficulty).toBe("EASY");
  });

  it("never describes it in medical terms", () => {
    assertAllCopySafe(result);
    const memory = result.profiles.find((p) => p.domain === "SHORT_TERM_MEMORY")!;
    const text = explainTrend(memory);
    expect(text.toLowerCase()).not.toContain("memory function");
    expect(text.toLowerCase()).not.toContain("impair");
  });
});

describe("User D — strong memory, weak attention", () => {
  const result = plan([
    ...series("SHORT_TERM_MEMORY", [92, 94, 90, 93, 95], { startDaysAgo: 5 }),
    ...series("ATTENTION", [45, 42, 48, 44, 46], { startDaysAgo: 5 }),
  ]);

  it("weights attention above memory", () => {
    const attention = result.ranked.findIndex((r) => r.domain === "ATTENTION");
    const memory = result.ranked.findIndex((r) => r.domain === "SHORT_TERM_MEMORY");
    expect(attention).toBeLessThan(memory);
  });

  it("keeps memory in the day rather than dropping it", () => {
    const domains = result.ranked.map((r) => r.domain);
    expect(domains).toContain("SHORT_TERM_MEMORY");
  });
});

describe("User E — plays the same activity over and over", () => {
  const samples = series("SHORT_TERM_MEMORY", [70, 72, 71, 73, 70], {
    startDaysAgo: 5,
  });
  const result = plan(samples, {
    recentGameIds: [
      "remember-objects",
      "remember-objects",
      "remember-objects",
      "remember-objects",
    ],
  });

  it("stops handing back the same activity", () => {
    expect(result.ranked[0].gameId).not.toBe("remember-objects");
  });

  it("suggests something different for variety", () => {
    expect(result.ranked[0].reasons).toContain("forVariety");
    const topDomains = new Set(result.daily.activities.map((a) => a.domain));
    expect(topDomains.size).toBe(result.daily.activities.length);
  });
});

describe("User F — irregular activity, long gaps", () => {
  const result = plan(series("SHORT_TERM_MEMORY", [70, 68, 72], { startDaysAgo: 40, dayStep: 10 }));

  it("welcomes them back gently instead of demanding a full day", () => {
    expect(result.daily.gentler).toBe(true);
    expect(result.daily.shape).toBe("SHORT");
    expect(result.daily.activities[0].primaryReason).toBe("gentleReturn");
  });

  it("carries no judgement in any of the wording", () => {
    assertAllCopySafe(result);
    const routineText = explainRoutine(result.routine).toLowerCase();
    for (const scolding of ["failed", "should have", "missed", "poor", "bad"]) {
      expect(routineText).not.toContain(scolding);
    }
  });

  it("greets a returning person with a welcome, not a streak loss", () => {
    expect(elderProgressKey(result.routine)).toBe("progressWelcomeBack");
  });
});

describe("User G — no AI provider configured", () => {
  it("reports AI as unavailable", () => {
    expect(aiAvailability()).toBe("AI_UNAVAILABLE");
  });

  it("produces a complete, explained experience regardless", () => {
    const result = plan([
      ...series("SHORT_TERM_MEMORY", [60, 65, 70, 68, 72], { startDaysAgo: 5 }),
      ...series("ATTENTION", [80, 82, 79, 83, 81], { startDaysAgo: 5 }),
    ]);

    expect(result.daily.activities.length).toBeGreaterThan(0);
    expect(result.ranked.every((r) => r.reasons.length > 0 || r.primaryReason)).toBe(true);
    for (const profile of result.profiles) {
      expect(explainTrend(profile).length).toBeGreaterThan(0);
    }
    assertAllCopySafe(result);
  });
});
