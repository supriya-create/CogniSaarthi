import type { CognitiveDomain } from "@prisma/client";

import {
  consistencyOf,
  masteryScore,
  sessionIndicator,
  weightedMean,
} from "@/lib/cognitive-performance/metrics";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import {
  BASELINE_MIN_SESSIONS,
  BASELINE_WINDOW,
} from "@/lib/intelligence/config";
import type { DomainBaseline } from "@/lib/intelligence/types";

/**
 * BASELINE (pure)
 * -----------------------------------------------------------------
 * "Where this person started" in a domain — the reference a later
 * change is measured against.
 *
 * Built from the EARLIEST sessions, not the most recent ones, because a
 * baseline that follows current form can never show movement: if it
 * drifted along with them, everybody would look permanently stable.
 *
 * It is deliberately refused until there are enough sessions. One good
 * morning or one bad one is not a baseline, and claiming otherwise
 * would make every later comparison meaningless.
 */
export function computeBaseline(
  domain: CognitiveDomain,
  samples: PerformanceSample[],
): DomainBaseline {
  const inDomain = samples
    .filter((s) => s.domain === domain)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime()); // oldest first

  if (inDomain.length < BASELINE_MIN_SESSIONS) {
    return {
      domain,
      state: "NOT_ESTABLISHED",
      sessionCount: inDomain.length,
      level: null,
      consistency: null,
      establishedAt: null,
    };
  }

  // The opening stretch of play defines the reference.
  const window = inDomain.slice(0, BASELINE_WINDOW);

  return {
    domain,
    state: "ESTABLISHED",
    sessionCount: window.length,
    level: Math.round(weightedMean(window.map(sessionIndicator))),
    consistency: consistencyOf(window.map(masteryScore)),
    // The moment there was enough history to establish it.
    establishedAt: inDomain[BASELINE_MIN_SESSIONS - 1].completedAt,
  };
}

/**
 * Movement away from the baseline, in indicator points. Positive means
 * activities are going better than when they started. Null whenever
 * either side is unknown — never a guess.
 */
export function deltaFromBaseline(
  baseline: DomainBaseline,
  current: number | null,
): number | null {
  if (baseline.state !== "ESTABLISHED") return null;
  if (baseline.level === null || current === null) return null;
  return current - baseline.level;
}
