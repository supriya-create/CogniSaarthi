import type { CognitiveDomain } from "@prisma/client";

import { HISTORY_WINDOW } from "@/lib/cognitive-performance/config";
import {
  consistencyOf,
  masteryScore,
  sessionIndicator,
  trendOf,
  weightedMean,
} from "@/lib/cognitive-performance/metrics";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import {
  DAY_MS,
  LONG_WINDOW_DAYS,
  MEDIUM_WINDOW_DAYS,
  TREND_DELTA_POINTS,
  TREND_MIN_WINDOW_SESSIONS,
  VARIABLE_CONSISTENCY_BELOW,
} from "@/lib/intelligence/config";
import { confidenceFor } from "@/lib/intelligence/confidence";
import type { TrendClass, TrendHorizon, TrendReading } from "@/lib/intelligence/types";

/**
 * LONGITUDINAL TRENDS (pure)
 * -----------------------------------------------------------------
 * Phase 2 answers "which way is this person going right now?" over its
 * five-session window. This answers the longer question by comparing a
 * recent window against the one before it, at three horizons.
 *
 * The classification is deliberately willing to say it does not know.
 * Two extra answers exist beyond up/down/steady:
 *
 *   VARIABLE          — results swing too much for a direction to mean
 *                       anything. Common, and far more honest than
 *                       picking whichever way the last session went.
 *   INSUFFICIENT_DATA — not enough sessions in the window. Also a real
 *                       answer; caregivers are told this plainly rather
 *                       than shown a confident-looking arrow.
 *
 * Phase 2's own `trendOf` is reused for the short horizon so the two
 * layers can never contradict each other on screen.
 */

/** Split samples for a domain into a recent and a preceding window. */
function windowsFor(
  samples: PerformanceSample[],
  horizon: TrendHorizon,
  now: Date,
): { recent: PerformanceSample[]; previous: PerformanceSample[] } {
  const sorted = [...samples].sort(
    (a, b) => b.completedAt.getTime() - a.completedAt.getTime(), // newest first
  );

  if (horizon === "SHORT") {
    // By COUNT: the last five sessions against the five before them.
    return {
      recent: sorted.slice(0, HISTORY_WINDOW),
      previous: sorted.slice(HISTORY_WINDOW, HISTORY_WINDOW * 2),
    };
  }

  // By TIME: sessions are sparse, so weeks are more meaningful than
  // counts once we are looking beyond the immediate past.
  const days = horizon === "MEDIUM" ? MEDIUM_WINDOW_DAYS : LONG_WINDOW_DAYS;
  const cutoff = now.getTime() - days * DAY_MS;
  const previousCutoff = now.getTime() - days * 2 * DAY_MS;

  return {
    recent: sorted.filter((s) => s.completedAt.getTime() >= cutoff),
    previous: sorted.filter(
      (s) =>
        s.completedAt.getTime() < cutoff &&
        s.completedAt.getTime() >= previousCutoff,
    ),
  };
}

/** Recency-weighted ability indicator for a set of sessions. */
function indicatorOf(samples: PerformanceSample[]): number | null {
  if (samples.length === 0) return null;
  // weightedMean expects oldest→newest so the latest counts for most.
  const ordered = [...samples].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );
  return Math.round(weightedMean(ordered.map(sessionIndicator)));
}

export function computeTrend(
  domain: CognitiveDomain,
  allSamples: PerformanceSample[],
  horizon: TrendHorizon,
  now: Date = new Date(),
): TrendReading {
  const inDomain = allSamples.filter((s) => s.domain === domain);
  const { recent, previous } = windowsFor(inDomain, horizon, now);

  const current = indicatorOf(recent);
  const previousLevel = indicatorOf(previous);

  const lastActivity = inDomain.reduce<Date | null>(
    (latest, s) => (!latest || s.completedAt > latest ? s.completedAt : latest),
    null,
  );
  const daysSince = lastActivity
    ? Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS)
    : null;

  // Oldest→newest scores drive both steadiness and Phase 2's slope.
  const recentScores = [...recent]
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
    .map(masteryScore);
  const consistency = consistencyOf(recentScores);

  const confidence = confidenceFor({
    sessionCount: recent.length,
    consistency,
    daysSinceLastActivity: daysSince,
  });

  const base = {
    horizon,
    current,
    previous: previousLevel,
    delta:
      current !== null && previousLevel !== null ? current - previousLevel : null,
    sessionCount: recent.length,
    confidence,
  };

  // Not enough recent play to say anything at all.
  if (recent.length < TREND_MIN_WINDOW_SESSIONS) {
    return { ...base, classification: "INSUFFICIENT_DATA" };
  }

  // Swinging too much for a direction to be meaningful.
  if (consistency !== null && consistency < VARIABLE_CONSISTENCY_BELOW) {
    return { ...base, classification: "VARIABLE" };
  }

  // No earlier window to compare against: fall back to Phase 2's slope
  // over the recent scores rather than inventing a comparison.
  if (base.delta === null) {
    return { ...base, classification: fromPhase2Trend(trendOf(recentScores)) };
  }

  if (base.delta >= TREND_DELTA_POINTS) {
    return { ...base, classification: "IMPROVING" };
  }
  if (base.delta <= -TREND_DELTA_POINTS) {
    return { ...base, classification: "DECLINING" };
  }
  return { ...base, classification: "STABLE" };
}

function fromPhase2Trend(trend: "improving" | "stable" | "declining"): TrendClass {
  return {
    improving: "IMPROVING" as const,
    stable: "STABLE" as const,
    declining: "DECLINING" as const,
  }[trend];
}

/** True when a reading is worth showing a caregiver as a direction. */
export function isReportableTrend(reading: TrendReading): boolean {
  return (
    reading.classification !== "INSUFFICIENT_DATA" &&
    reading.confidence !== "LOW"
  );
}
