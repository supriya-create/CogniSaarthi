import type { CognitiveDomain } from "@prisma/client";

import { computeDomainPerformance } from "@/lib/cognitive-performance/performance";
import { sessionIndicator, weightedMean } from "@/lib/cognitive-performance/metrics";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import { dayIndex, localDayOf } from "@/lib/reminders/timezone";
import { computeBaseline } from "@/lib/intelligence/baseline";
import { computeTrend } from "@/lib/intelligence/trends";
import { confidenceFor } from "@/lib/intelligence/confidence";
import { ACTIVE_DOMAINS } from "@/lib/intelligence/domains";
import { DAY_MS, ROUTINE_WINDOW_DAYS } from "@/lib/intelligence/config";
import type {
  ActivityRoutine,
  LongitudinalDomainProfile,
} from "@/lib/intelligence/types";

/**
 * THE LONG ARC (pure)
 * -----------------------------------------------------------------
 * Assembles one picture per domain by composing what already exists:
 * Phase 2 supplies mastery, steadiness and the short-window trend; this
 * layer adds the baseline, the longer horizons and an honest confidence.
 *
 * Phase 2 is never recomputed differently here. If the two ever seemed
 * to disagree on screen it would be this file's fault, so the short
 * trend is carried through verbatim rather than re-derived.
 */

export function buildDomainProfile(
  domain: CognitiveDomain,
  samples: PerformanceSample[],
  now: Date = new Date(),
): LongitudinalDomainProfile {
  // Phase 2's short-window view — the authority on current form.
  const performance = computeDomainPerformance(domain, samples);

  const inDomain = samples.filter((s) => s.domain === domain);
  const lastActivityAt = inDomain.reduce<Date | null>(
    (latest, s) => (!latest || s.completedAt > latest ? s.completedAt : latest),
    null,
  );
  const daysSinceLastActivity = lastActivityAt
    ? Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS)
    : null;

  // Whole-history ability, oldest→newest so recency still counts most.
  const longTermPerformance =
    inDomain.length > 0
      ? Math.round(
          weightedMean(
            [...inDomain]
              .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
              .map(sessionIndicator),
          ),
        )
      : null;

  return {
    domain,
    mastery: performance.mastery,
    recentPerformance: performance.indicator,
    longTermPerformance,
    consistency: performance.consistency,
    shortTrend: performance.trend,
    trend: computeTrend(domain, samples, "MEDIUM", now),
    confidence: confidenceFor({
      sessionCount: inDomain.length,
      consistency: performance.consistency,
      daysSinceLastActivity,
    }),
    baseline: computeBaseline(domain, samples),
    activityCount: inDomain.length,
    lastActivityAt,
    currentDifficulty: performance.currentDifficulty,
  };
}

/** One profile per domain that actually has an activity behind it. */
export function buildAllDomainProfiles(
  samples: PerformanceSample[],
  now: Date = new Date(),
): LongitudinalDomainProfile[] {
  return ACTIVE_DOMAINS.map((domain) =>
    buildDomainProfile(domain, samples, now),
  );
}

/**
 * ACTIVITY ROUTINE — explicitly not a health measure.
 *
 * This counts how regularly someone opens the app and does something.
 * It is named "routine" throughout, never "cognitive health": a person
 * who was on holiday for a week has a lower number and nothing
 * whatsoever has changed about them.
 */
export function computeActivityRoutine(
  samples: PerformanceSample[],
  now: Date = new Date(),
  timeZone = "Asia/Kolkata",
  windowDays = ROUTINE_WINDOW_DAYS,
): ActivityRoutine {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const inWindow = samples.filter((s) => s.completedAt.getTime() >= cutoff);

  const activeDaySet = new Set<number>();
  for (const sample of inWindow) {
    activeDaySet.add(dayIndex(localDayOf(sample.completedAt, timeZone)));
  }

  const lastActivity = samples.reduce<Date | null>(
    (latest, s) => (!latest || s.completedAt > latest ? s.completedAt : latest),
    null,
  );

  const activeDays = activeDaySet.size;
  return {
    activeDays,
    daysInWindow: windowDays,
    activitiesPerWeek:
      Math.round((inWindow.length / windowDays) * 7 * 10) / 10,
    routineConsistency:
      windowDays > 0 ? Math.round((activeDays / windowDays) * 100) : 0,
    daysSinceLastActivity: lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS)
      : null,
    totalActivities: samples.length,
  };
}
