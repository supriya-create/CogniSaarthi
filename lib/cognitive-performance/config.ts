import type { CognitiveDomain, Difficulty } from "@prisma/client";

/**
 * COGNITIVE PERFORMANCE — TUNABLE CONSTANTS
 * -----------------------------------------------------------------
 * Every number the engine uses lives here, named and commented, so
 * the whole personalisation system can be read and reasoned about in
 * one place. Nothing about this is a black box: it is a transparent
 * rule set, and Phase 2 deliberately stops short of a trained model
 * so that every recommendation can be explained in one sentence.
 *
 * This is NOT a diagnostic system. Nothing here estimates a medical
 * condition. The output is "which activity, at which level, next" —
 * an assistance decision, not a clinical one.
 */

// -----------------------------------------------------------------
// History window
// -----------------------------------------------------------------

/** How many recent completed sessions per domain the engine reads. */
export const HISTORY_WINDOW = 5;

/**
 * Below this many completed sessions in a domain the engine is in
 * "cold start": it does not pretend to know the person's ability and
 * simply keeps them at the starting level.
 */
export const COLD_START_MIN_SESSIONS = 3;

// -----------------------------------------------------------------
// Difficulty ordering
// -----------------------------------------------------------------

export const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
export const STARTING_DIFFICULTY: Difficulty = "EASY";

// -----------------------------------------------------------------
// Performance indicator — difficulty bands
// -----------------------------------------------------------------
/**
 * The performance indicator (shown to caregivers, used to rank weak
 * domains) maps a session onto a 0–100 ability scale. Accuracy is
 * placed inside a band chosen by the difficulty played, so doing
 * well at a harder level scores higher than the same accuracy at an
 * easier one, and the bands overlap the way real ability does.
 *
 *   perfect EASY  = 70      perfect MEDIUM = 85      perfect HARD = 100
 *   failed  EASY  =  0      failed  MEDIUM = 15      failed  HARD =  30
 */
export const DIFFICULTY_BANDS: Record<
  Difficulty,
  { low: number; high: number }
> = {
  EASY: { low: 0, high: 70 },
  MEDIUM: { low: 15, high: 85 },
  HARD: { low: 30, high: 100 },
};

// -----------------------------------------------------------------
// Small, bounded modifiers to the indicator
// -----------------------------------------------------------------
/**
 * Hints and response time nudge the indicator only slightly. They
 * are intentionally minor: an older adult taking their time on an
 * activity is not doing worse, and penalising slowness would be both
 * unfair and, for this audience, inappropriate. These exist so the
 * architecture accounts for them, not so they dominate the result.
 */
export const MAX_HINT_PENALTY = 8;
export const MAX_SPEED_ADJUSTMENT = 4;

/**
 * Per-domain "comfortable" average response time per round, in ms,
 * with a tolerance inside which no speed adjustment is applied at
 * all. Only markedly faster or slower play nudges the indicator, and
 * only by up to MAX_SPEED_ADJUSTMENT points.
 */
export const SPEED_REFERENCE_MS: Record<
  CognitiveDomain,
  { reference: number; tolerance: number }
> = {
  SHORT_TERM_MEMORY: { reference: 15000, tolerance: 9000 },
  ATTENTION: { reference: 4000, tolerance: 2500 },
  WORKING_MEMORY: { reference: 9000, tolerance: 5000 },
  // Reserved for later domains; sensible neutral defaults for now.
  LANGUAGE: { reference: 8000, tolerance: 5000 },
  PROCESSING_SPEED: { reference: 3000, tolerance: 2000 },
  EXECUTIVE_FUNCTION: { reference: 10000, tolerance: 6000 },
};

// -----------------------------------------------------------------
// Consistency
// -----------------------------------------------------------------
/**
 * Consistency = 100 − (standard deviation of recent scores × K),
 * clamped to 0–100. A steady 88/90/89 scores near 100; a swinging
 * 95/45/90 scores low. Difficulty step-ups require decent
 * consistency, so an unstable performer is never pushed up on the
 * strength of their good days alone.
 */
export const CONSISTENCY_K = 2.5;
export const CONSISTENCY_GOOD = 65;
/** Below this, confidence is capped one level lower. */
export const CONSISTENCY_SHAKY = 50;

// -----------------------------------------------------------------
// Trend
// -----------------------------------------------------------------
/** Least-squares slope (points per session) past which a run counts
 *  as improving or declining; between the two it is stable. */
export const TREND_SLOPE_THRESHOLD = 2;
export const TREND_MIN_SESSIONS = 3;

// -----------------------------------------------------------------
// Adaptive difficulty thresholds (operate on the mastery score —
// the raw accuracy at the level played, i.e. "was this level right?")
// -----------------------------------------------------------------
/** Clear mastery: step up if consistent and not declining. */
export const STEP_UP_STRONG = 85;
/** Nearly there and climbing: step up cautiously if the trend is up. */
export const STEP_UP_IMPROVING = 78;
/** Struggling at the current level: step down. */
export const STEP_DOWN_BELOW = 65;

// -----------------------------------------------------------------
// Recency weighting
// -----------------------------------------------------------------
/**
 * Recent sessions count for more. Weights are linear across the
 * window (oldest = 1 … newest = n), so a person's latest form drives
 * the decision without a single old session being ignored.
 */
export function recencyWeights(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

// -----------------------------------------------------------------
// Daily journey balance
// -----------------------------------------------------------------
/**
 * A day's activities lead with weaker domains but never only drill
 * the weakest — challenge, confidence and variety together. With the
 * three Phase 1 games (one per domain) this orders all three from
 * weakest to strongest; the ratio generalises when more games and
 * domains exist.
 */
export const JOURNEY_WEAK_FIRST = true;
export const ESTIMATED_MINUTES_PER_ACTIVITY = 4;
