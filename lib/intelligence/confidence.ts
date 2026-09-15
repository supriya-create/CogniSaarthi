import { confidenceFrom } from "@/lib/cognitive-performance/performance";
import type { Confidence } from "@/lib/cognitive-performance/types";
import { STALE_AFTER_DAYS } from "@/lib/intelligence/config";

/**
 * CONFIDENCE (pure)
 * -----------------------------------------------------------------
 * How much weight a reading deserves. Phase 2 already answers this for
 * a short window (volume + steadiness), so that function is reused
 * directly rather than reimplemented — the two must never disagree.
 *
 * What this layer adds is RECENCY. A confident read of someone's form
 * is worthless if the form is a month old, so stale data is downgraded
 * rather than presented as current.
 *
 * Nothing low-confidence is ever stated as fact; the presentation layer
 * checks this value before wording anything as a conclusion.
 */

const ORDER: Confidence[] = ["LOW", "MEDIUM", "HIGH"];

export function downgrade(confidence: Confidence, steps = 1): Confidence {
  const index = ORDER.indexOf(confidence);
  return ORDER[Math.max(0, index - steps)];
}

export interface ConfidenceInputs {
  sessionCount: number;
  /** 0–100 steadiness of recent scores; null when unknown. */
  consistency: number | null;
  /** Whole days since the last activity in this domain; null if never. */
  daysSinceLastActivity: number | null;
}

/**
 * Volume and steadiness from Phase 2, then a recency penalty.
 * A domain never played, or not played for weeks, cannot support a
 * high-confidence statement however good the old numbers were.
 */
export function confidenceFor(inputs: ConfidenceInputs): Confidence {
  const base = confidenceFrom(inputs.sessionCount, inputs.consistency);

  if (inputs.daysSinceLastActivity === null) return "LOW";
  if (inputs.daysSinceLastActivity > STALE_AFTER_DAYS) return downgrade(base);

  return base;
}

/** True when a reading may be worded as a statement rather than a hint. */
export function canStateAsFact(confidence: Confidence): boolean {
  return confidence !== "LOW";
}

/** Caregiver-facing wording for a confidence level. */
export function confidenceLabel(confidence: Confidence): string {
  return { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }[confidence];
}
