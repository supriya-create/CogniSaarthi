import type { CognitiveDomain } from "@prisma/client";

import {
  COLD_START_MIN_SESSIONS,
  CONSISTENCY_SHAKY,
  HISTORY_WINDOW,
  STARTING_DIFFICULTY,
} from "@/lib/cognitive-performance/config";
import {
  consistencyOf,
  masteryScore,
  sessionIndicator,
  trendOf,
  weightedMean,
} from "@/lib/cognitive-performance/metrics";
import type {
  Confidence,
  DomainPerformance,
  PerformanceSample,
} from "@/lib/cognitive-performance/types";

/**
 * Turns a person's history in one cognitive domain into a single
 * performance picture: how well, how steadily, which way they are
 * trending, and how much the engine can trust that read.
 *
 * The input may be the person's whole history; this function selects
 * the domain's most recent sessions itself.
 */
export function computeDomainPerformance(
  domain: CognitiveDomain,
  allSamples: PerformanceSample[],
): DomainPerformance {
  // Newest first, then take the window, then restore oldest→newest so
  // trend and recency weighting read in chronological order.
  const relevant = allSamples
    .filter((s) => s.domain === domain)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, HISTORY_WINDOW)
    .reverse();

  const sessionCount = relevant.length;
  const currentDifficulty =
    relevant.length > 0
      ? relevant[relevant.length - 1].difficulty
      : STARTING_DIFFICULTY;

  if (sessionCount < COLD_START_MIN_SESSIONS) {
    return {
      domain,
      sessionCount,
      coldStart: true,
      indicator: null,
      mastery: null,
      consistency: consistencyOf(relevant.map(masteryScore)),
      trend: "stable",
      confidence: "LOW",
      currentDifficulty,
    };
  }

  const scores = relevant.map(masteryScore);
  const indicators = relevant.map(sessionIndicator);

  const indicator = Math.round(weightedMean(indicators));
  const mastery = Math.round(weightedMean(scores));
  const consistency = consistencyOf(scores);
  const trend = trendOf(scores);

  return {
    domain,
    sessionCount,
    coldStart: false,
    indicator,
    mastery,
    consistency,
    trend,
    confidence: confidenceFrom(sessionCount, consistency),
    currentDifficulty,
  };
}

/**
 * Confidence rises with the amount of data and falls when recent
 * scores swing about. It is the engine being honest about how much
 * weight its own recommendation deserves.
 */
export function confidenceFrom(
  sessionCount: number,
  consistency: number | null,
): Confidence {
  if (sessionCount < COLD_START_MIN_SESSIONS) return "LOW";

  const shaky = consistency !== null && consistency < CONSISTENCY_SHAKY;

  if (sessionCount >= 7) return shaky ? "MEDIUM" : "HIGH";
  // 3–6 sessions
  return shaky ? "LOW" : "MEDIUM";
}

/** Convenience: compute every domain present in the samples at once. */
export function computeAllDomains(
  domains: CognitiveDomain[],
  allSamples: PerformanceSample[],
): DomainPerformance[] {
  return domains.map((domain) =>
    computeDomainPerformance(domain, allSamples),
  );
}
