import { describe, expect, it } from "vitest";
import type { CognitiveDomain, Difficulty } from "@prisma/client";

import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import { buildAllDomainProfiles, computeActivityRoutine } from "@/lib/intelligence/longitudinal";
import { rankActivities, type RecommendationContext } from "@/lib/intelligence/recommendations";
import { buildDailyPlan, looksEffortful } from "@/lib/intelligence/daily-plan";
import { NOW, series } from "@/lib/intelligence/__tests__/_helpers";

/**
 * The recommendation engine. The behaviour under most scrutiny here is
 * that it does NOT simply serve the weakest activity every day.
 */

const GAMES = [
  { gameId: "remember-objects", domain: "SHORT_TERM_MEMORY" as CognitiveDomain },
  { gameId: "find-different", domain: "ATTENTION" as CognitiveDomain },
  { gameId: "remember-sequence", domain: "WORKING_MEMORY" as CognitiveDomain },
  { gameId: "story-recall", domain: "LANGUAGE" as CognitiveDomain },
];

function context(
  samples: PerformanceSample[],
  overrides: Partial<RecommendationContext> = {},
): RecommendationContext {
  const difficultyByDomain = new Map<CognitiveDomain, Difficulty>(
    GAMES.map((g) => [g.domain, "MEDIUM" as Difficulty]),
  );
  return {
    profiles: buildAllDomainProfiles(samples, NOW),
    routine: computeActivityRoutine(samples, NOW),
    availableGames: GAMES,
    recentGameIds: [],
    completedTodayGameIds: [],
    difficultyByDomain,
    ...overrides,
  };
}

/**
 * A person who is clearly weaker at memory than at everything else,
 * and who played yesterday — so the "gentle return" path (5+ days
 * away) is not what is under test here.
 */
function weakMemoryHistory(): PerformanceSample[] {
  return [
    ...series("SHORT_TERM_MEMORY", [40, 42, 38, 41, 39], { startDaysAgo: 5 }),
    ...series("ATTENTION", [88, 90, 89, 91, 90], { startDaysAgo: 5 }),
    ...series("WORKING_MEMORY", [85, 86, 84, 87, 85], { startDaysAgo: 5 }),
    ...series("LANGUAGE", [82, 83, 84, 85, 83], { startDaysAgo: 5 }),
  ];
}

describe("practice need", () => {
  it("puts the weaker area first", () => {
    const ranked = rankActivities(context(weakMemoryHistory()));
    expect(ranked[0].domain).toBe("SHORT_TERM_MEMORY");
    expect(ranked[0].reasons).toContain("needsPractice");
  });

  it("still offers the other areas — never drills one thing only", () => {
    const ranked = rankActivities(context(weakMemoryHistory()));
    const domains = new Set(ranked.slice(0, 3).map((r) => r.domain));
    expect(domains.size).toBe(3);
  });
});

describe("variety and anti-repetition", () => {
  it("demotes the activity just played", () => {
    const samples = weakMemoryHistory();
    const withoutRepeat = rankActivities(context(samples));
    const afterPlayingIt = rankActivities(
      context(samples, { recentGameIds: ["remember-objects"] }),
    );

    expect(withoutRepeat[0].gameId).toBe("remember-objects");
    // Having just played it, it should no longer lead.
    expect(afterPlayingIt[0].gameId).not.toBe("remember-objects");
  });

  it("never repeats a domain while another is unused", () => {
    const ranked = rankActivities(context(weakMemoryHistory()));
    const firstFour = ranked.slice(0, 4).map((r) => r.domain);
    expect(new Set(firstFour).size).toBe(firstFour.length);
  });

  it("credits an activity that has not come up lately", () => {
    const ranked = rankActivities(
      context(weakMemoryHistory(), {
        recentGameIds: ["find-different", "find-different", "find-different"],
      }),
    );
    const attention = ranked.find((r) => r.gameId === "find-different")!;
    expect(attention.reasons).not.toContain("forVariety");
  });

  it("excludes anything already completed today", () => {
    const ranked = rankActivities(
      context(weakMemoryHistory(), {
        completedTodayGameIds: ["remember-objects", "find-different"],
      }),
    );
    const ids = ranked.map((r) => r.gameId);
    expect(ids).not.toContain("remember-objects");
    expect(ids).not.toContain("find-different");
    expect(ids.length).toBe(2);
  });
});

describe("preference and success", () => {
  it("gives a small nudge to a favourite activity", () => {
    const samples = weakMemoryHistory();
    const plain = rankActivities(context(samples));
    const preferred = rankActivities(
      context(samples, { preferredGameIds: ["story-recall"] }),
    );
    const before = plain.find((r) => r.gameId === "story-recall")!.score;
    const after = preferred.find((r) => r.gameId === "story-recall")!.score;
    expect(after).toBeGreaterThan(before);
  });

  it("recognises an area that has been going well", () => {
    // Clear upward run so Phase 2 calls the short trend "improving".
    const samples = series("ATTENTION", [55, 62, 70, 78, 88], { startDaysAgo: 8 });
    const ranked = rankActivities(context(samples));
    const attention = ranked.find((r) => r.domain === "ATTENTION")!;
    expect(attention.reasons).toContain("buildOnSuccess");
  });
});

describe("cold start", () => {
  it("makes a simple suggestion without pretending to know anything", () => {
    const ranked = rankActivities(context([]));
    expect(ranked.length).toBe(GAMES.length);
    expect(ranked[0].primaryReason).toBe("coldStart");
    expect(ranked[0].confidence).toBe("LOW");
  });
});

describe("daily plan", () => {
  it("suggests a normal day for a steady player", () => {
    const plan = buildDailyPlan({
      ...context(weakMemoryHistory()),
      completedToday: 0,
      recentSamples: weakMemoryHistory().filter(
        (s) => s.domain !== "SHORT_TERM_MEMORY",
      ),
    });
    expect(plan.shape).toBe("NORMAL");
    expect(plan.activities).toHaveLength(3);
    expect(plan.complete).toBe(false);
  });

  it("offers an optional extra, never a requirement", () => {
    const plan = buildDailyPlan({
      ...context(weakMemoryHistory()),
      completedToday: 0,
      recentSamples: [],
    });
    expect(plan.optionalExtra).not.toBeNull();
    expect(plan.activities).not.toContainEqual(plan.optionalExtra);
  });

  it("shortens the day when activities have been hard work", () => {
    // A run of low scores with heavy hint use.
    const effortful = series("SHORT_TERM_MEMORY", [35, 30, 40, 32], {
      startDaysAgo: 5,
      hintsPerSession: 4,
    });
    expect(looksEffortful(effortful)).toBe(true);

    const plan = buildDailyPlan({
      ...context(effortful),
      completedToday: 0,
      recentSamples: effortful,
    });
    expect(plan.shape).toBe("SHORT");
    expect(plan.gentler).toBe(true);
    expect(plan.activities.length).toBeLessThanOrEqual(2);
  });

  it("does not call one bad session 'effortful'", () => {
    expect(looksEffortful(series("SHORT_TERM_MEMORY", [20]))).toBe(false);
    expect(looksEffortful(series("SHORT_TERM_MEMORY", [20, 25]))).toBe(false);
  });

  it("eases somebody back in after a long gap", () => {
    const stale = series("SHORT_TERM_MEMORY", [70, 72, 74], { startDaysAgo: 30 });
    const plan = buildDailyPlan({
      ...context(stale),
      completedToday: 0,
      recentSamples: stale,
    });
    expect(plan.gentler).toBe(true);
    expect(plan.activities[0].primaryReason).toBe("gentleReturn");
  });

  it("shrinks as the day is completed, and reports when it is done", () => {
    const samples = weakMemoryHistory();
    const partial = buildDailyPlan({
      ...context(samples, { completedTodayGameIds: ["remember-objects"] }),
      completedToday: 1,
      recentSamples: [],
    });
    expect(partial.activities.map((a) => a.gameId)).not.toContain("remember-objects");
    expect(partial.completedToday).toBe(1);

    const all = buildDailyPlan({
      ...context(samples, {
        completedTodayGameIds: GAMES.map((g) => g.gameId),
      }),
      completedToday: 4,
      recentSamples: [],
    });
    expect(all.activities).toHaveLength(0);
    expect(all.complete).toBe(true);
  });
});
