import type { Difficulty } from "@prisma/client";

import {
  CONSISTENCY_K,
  DIFFICULTY_BANDS,
  MAX_HINT_PENALTY,
  MAX_SPEED_ADJUSTMENT,
  SPEED_REFERENCE_MS,
  TREND_MIN_SESSIONS,
  TREND_SLOPE_THRESHOLD,
  recencyWeights,
} from "@/lib/cognitive-performance/config";
import type {
  PerformanceSample,
  Trend,
} from "@/lib/cognitive-performance/types";

/**
 * The mathematics of the performance engine, as small pure functions.
 * Each one does a single, testable thing; the aggregation in
 * performance.ts composes them.
 */

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation. Returns 0 for fewer than 2 values. */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Recency-weighted mean: `values` in oldest→newest order. */
export function weightedMean(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = recencyWeights(values.length);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const weighted = values.reduce((sum, v, i) => sum + v * weights[i], 0);
  return weighted / totalWeight;
}

// -----------------------------------------------------------------
// Per-session performance indicator (for display and weakness ranking)
// -----------------------------------------------------------------

/** Penalty for leaning on hints, bounded and proportional to rounds. */
export function hintPenalty(sample: PerformanceSample): number {
  if (sample.roundsTotal <= 0 || sample.hints <= 0) return 0;
  const ratio = Math.min(1, sample.hints / sample.roundsTotal);
  return ratio * MAX_HINT_PENALTY;
}

/**
 * A small nudge for speed. Zero inside the comfortable band, and at
 * most ±MAX_SPEED_ADJUSTMENT outside it. Missing timing (0) yields 0,
 * so absent telemetry never counts against anyone.
 */
export function speedAdjustment(sample: PerformanceSample): number {
  if (sample.avgResponseTimeMs <= 0) return 0;
  const ref = SPEED_REFERENCE_MS[sample.domain];
  if (!ref) return 0;

  const delta = ref.reference - sample.avgResponseTimeMs; // +ve = faster
  if (Math.abs(delta) <= ref.tolerance) return 0;

  const beyond = Math.abs(delta) - ref.tolerance;
  const magnitude = Math.min(
    MAX_SPEED_ADJUSTMENT,
    (beyond / ref.reference) * MAX_SPEED_ADJUSTMENT * 2,
  );
  return delta > 0 ? magnitude : -magnitude;
}

/**
 * Maps one session onto the 0–100 ability scale: accuracy inside the
 * band for the difficulty played, less a small hint penalty, plus a
 * small speed nudge.
 */
export function sessionIndicator(sample: PerformanceSample): number {
  const band = DIFFICULTY_BANDS[sample.difficulty];
  const base = band.low + sample.accuracy * (band.high - band.low);
  return clamp(base - hintPenalty(sample) + speedAdjustment(sample));
}

/**
 * The mastery score is simply the accuracy at the level played
 * (0–100). It answers "is this difficulty the right fit right now?"
 * and drives the adaptive step decision — distinct from the banded
 * indicator, which compares ability across levels.
 */
export function masteryScore(sample: PerformanceSample): number {
  return clamp(sample.score);
}

// -----------------------------------------------------------------
// Consistency and trend, over a window of scores (oldest→newest)
// -----------------------------------------------------------------

/** 100 = rock steady, low = swinging. Null with fewer than 2 scores. */
export function consistencyOf(scores: number[]): number | null {
  if (scores.length < 2) return null;
  return clamp(100 - stdev(scores) * CONSISTENCY_K);
}

/** Least-squares slope of scores against their index (per session). */
export function slopeOf(scores: number[]): number {
  const n = scores.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(scores);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - xMean) * (scores[i] - yMean);
    sxx += (xs[i] - xMean) ** 2;
  }
  return sxx === 0 ? 0 : sxy / sxx;
}

export function trendOf(scores: number[]): Trend {
  if (scores.length < TREND_MIN_SESSIONS) return "stable";
  const slope = slopeOf(scores);
  if (slope >= TREND_SLOPE_THRESHOLD) return "improving";
  if (slope <= -TREND_SLOPE_THRESHOLD) return "declining";
  return "stable";
}

// -----------------------------------------------------------------
// Difficulty stepping helpers
// -----------------------------------------------------------------

export function stepDifficulty(
  current: Difficulty,
  direction: "up" | "down",
  order: Difficulty[],
): Difficulty {
  const index = order.indexOf(current);
  if (index === -1) return current;
  const next = direction === "up" ? index + 1 : index - 1;
  if (next < 0 || next >= order.length) return current;
  return order[next];
}
