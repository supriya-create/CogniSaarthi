import type { Difficulty } from "@prisma/client";

import {
  CONSISTENCY_GOOD,
  DIFFICULTY_ORDER,
  STARTING_DIFFICULTY,
  STEP_DOWN_BELOW,
  STEP_UP_IMPROVING,
  STEP_UP_STRONG,
} from "@/lib/cognitive-performance/config";
import { stepDifficulty } from "@/lib/cognitive-performance/metrics";
import type {
  DifficultyRecommendation,
  DomainPerformance,
} from "@/lib/cognitive-performance/types";

/**
 * ADAPTIVE DIFFICULTY
 * -----------------------------------------------------------------
 * The rule the whole feature turns on. Given a domain's performance
 * picture, choose the level for the next activity. It is transparent
 * by design — every branch below maps to one plain-language reason —
 * and it obeys three safety rules:
 *
 *   1. Cold start never guesses: too little data → the start level.
 *   2. It moves at most one level at a time (no EASY→HARD jumps).
 *   3. An unstable performer is not pushed up on their good days;
 *      a step up needs both a high mastery score AND consistency.
 *
 * The decision reads the MASTERY score (accuracy at the level being
 * played), because that is what answers "is this level the right fit
 * right now?" — not the cross-level ability indicator.
 */
export function recommendDifficulty(
  performance: DomainPerformance,
): DifficultyRecommendation {
  const current = performance.currentDifficulty;

  const base = {
    domain: performance.domain,
    previousDifficulty: current,
    confidence: performance.confidence,
  };

  // 1. Cold start — hold at the starting level, no pretence of insight.
  if (performance.coldStart || performance.mastery === null) {
    return {
      ...base,
      difficulty: STARTING_DIFFICULTY,
      previousDifficulty: current,
      direction: "hold",
      reason: "coldStart",
    };
  }

  const mastery = performance.mastery;
  const consistent =
    performance.consistency !== null &&
    performance.consistency >= CONSISTENCY_GOOD;
  const notDeclining = performance.trend !== "declining";

  // 2. Struggling at this level → ease off.
  if (mastery < STEP_DOWN_BELOW) {
    return finaliseStep(base, current, "down", "steppedDown");
  }

  // 3. Clear mastery, steady, not sliding → step up.
  if (mastery >= STEP_UP_STRONG && consistent && notDeclining) {
    return finaliseStep(base, current, "up", "steppedUpStrong");
  }

  // 4. Close to mastery and climbing → step up cautiously.
  if (
    mastery >= STEP_UP_IMPROVING &&
    performance.trend === "improving" &&
    consistent
  ) {
    return finaliseStep(base, current, "up", "steppedUpImproving");
  }

  // 5. Otherwise hold. Call out when instability is what held it.
  const heldReason =
    mastery >= STEP_UP_STRONG && !consistent ? "heldUnstable" : "held";
  return {
    ...base,
    difficulty: current,
    direction: "hold",
    reason: heldReason,
  };
}

function finaliseStep(
  base: Pick<
    DifficultyRecommendation,
    "domain" | "previousDifficulty" | "confidence"
  >,
  current: Difficulty,
  direction: "up" | "down",
  reason: DifficultyRecommendation["reason"],
): DifficultyRecommendation {
  const next = stepDifficulty(current, direction, DIFFICULTY_ORDER);

  // Already at the ceiling or floor: hold, and say so.
  if (next === current) {
    return {
      ...base,
      difficulty: current,
      direction: "hold",
      reason: direction === "up" ? "atMaximum" : "atMinimum",
    };
  }

  return { ...base, difficulty: next, direction, reason };
}
