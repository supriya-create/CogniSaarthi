import type { CognitiveDomain, Difficulty } from "@prisma/client";

import type { PerformanceSample } from "@/lib/cognitive-performance/types";

/** A fixed "now" so every test is deterministic. */
export const NOW = new Date("2026-09-14T12:00:00.000Z");

const DAY = 86_400_000;

export function daysAgo(days: number, from: Date = NOW): Date {
  return new Date(from.getTime() - days * DAY);
}

export function sample(
  overrides: Partial<PerformanceSample> = {},
): PerformanceSample {
  return {
    domain: "SHORT_TERM_MEMORY",
    difficulty: "MEDIUM",
    score: 75,
    accuracy: 0.75,
    mistakes: 1,
    hints: 0,
    roundsTotal: 5,
    avgResponseTimeMs: 0,
    completedAt: daysAgo(1),
    ...overrides,
  };
}

/**
 * A run of sessions in one domain, newest LAST.
 * `scores` drives both the score and the accuracy so the Phase 2
 * indicator moves with it, and each session is one day apart.
 */
export function series(
  domain: CognitiveDomain,
  scores: number[],
  options: {
    difficulty?: Difficulty;
    /** Day offset of the OLDEST session. Defaults to scores.length. */
    startDaysAgo?: number;
    hintsPerSession?: number;
    dayStep?: number;
  } = {},
): PerformanceSample[] {
  const {
    difficulty = "MEDIUM",
    startDaysAgo = scores.length,
    hintsPerSession = 0,
    dayStep = 1,
  } = options;

  return scores.map((score, index) =>
    sample({
      domain,
      difficulty,
      score,
      accuracy: score / 100,
      hints: hintsPerSession,
      completedAt: daysAgo(startDaysAgo - index * dayStep),
    }),
  );
}
