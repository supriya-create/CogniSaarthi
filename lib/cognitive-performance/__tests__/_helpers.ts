import type { CognitiveDomain, Difficulty } from "@prisma/client";

import type { PerformanceSample } from "@/lib/cognitive-performance/types";

let clock = 0;

/**
 * Build a sample with sensible defaults. `score` drives accuracy
 * unless accuracy is given. `completedAt` auto-increments so a list
 * built in call order reads oldest→newest.
 */
export function sample(
  partial: Partial<PerformanceSample> & { score: number },
): PerformanceSample {
  const score = partial.score;
  return {
    domain: partial.domain ?? "SHORT_TERM_MEMORY",
    difficulty: partial.difficulty ?? "EASY",
    score,
    accuracy: partial.accuracy ?? score / 100,
    mistakes: partial.mistakes ?? 0,
    hints: partial.hints ?? 0,
    roundsTotal: partial.roundsTotal ?? 5,
    avgResponseTimeMs: partial.avgResponseTimeMs ?? 0,
    completedAt: partial.completedAt ?? new Date(2026, 0, 1, 0, 0, clock++),
  };
}

/** A run of sessions at one difficulty from a list of scores. */
export function runOfScores(
  scores: number[],
  opts: { domain?: CognitiveDomain; difficulty?: Difficulty } = {},
): PerformanceSample[] {
  return scores.map((score) => sample({ score, ...opts }));
}
