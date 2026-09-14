import type { CognitiveDomain, Difficulty } from "@prisma/client";

import { HISTORY_WINDOW } from "@/lib/cognitive-performance/config";
import {
  sessionIndicator,
  weightedMean,
  trendOf,
} from "@/lib/cognitive-performance/metrics";
import type {
  PerformanceSample,
  Trend,
} from "@/lib/cognitive-performance/types";

/**
 * SUMMARY COMPUTATION (pure and testable)
 * -----------------------------------------------------------------
 * Human-readable daily and weekly pictures for the caregiver. These
 * REUSE the Phase 2 performance maths (sessionIndicator, weightedMean,
 * trendOf) — there is no second cognitive scoring system here, only a
 * before/after framing of the same indicator. Nothing is a medical
 * report; the caregiver copy calls it the "Cognisaarthi Weekly Summary".
 */

// ---------------------------- daily ----------------------------

export interface DailySummaryInput {
  completedToday: number;
  dailyGoal: number;
  domainsCompletedToday: CognitiveDomain[];
  reminderTotalToday: number;
  reminderAcknowledgedToday: number;
}

export interface DailySummary {
  activities: { completed: number; goal: number };
  /** Memory-domain participation today. */
  memory: "notYet" | "some" | "good";
  /** Attention-domain participation today. */
  attention: "notYet" | "done";
  reminders: { total: number; acknowledged: number };
}

export function buildDailySummary(input: DailySummaryInput): DailySummary {
  const hasMemory = input.domainsCompletedToday.includes("SHORT_TERM_MEMORY");
  const hasAttention = input.domainsCompletedToday.includes("ATTENTION");
  return {
    activities: { completed: input.completedToday, goal: input.dailyGoal },
    memory: hasMemory
      ? input.completedToday >= input.dailyGoal
        ? "good"
        : "some"
      : "notYet",
    attention: hasAttention ? "done" : "notYet",
    reminders: {
      total: input.reminderTotalToday,
      acknowledged: input.reminderAcknowledgedToday,
    },
  };
}

// ---------------------------- weekly ----------------------------

export interface WeeklyDomainTrend {
  domain: CognitiveDomain;
  /** Ability indicator over the earlier sessions; null if too few. */
  previous: number | null;
  /** Ability indicator over the most recent sessions; null if none. */
  current: number | null;
  trend: Trend;
  currentDifficulty: Difficulty | null;
}

/**
 * Before/after indicator for one domain, using the Phase 2 indicator.
 * The most recent `HISTORY_WINDOW` sessions form "current"; the window
 * before that forms "previous", so the caregiver sees "72 → 78".
 */
export function computeWeeklyDomainTrend(
  domain: CognitiveDomain,
  samples: PerformanceSample[],
): WeeklyDomainTrend {
  const inDomain = samples
    .filter((s) => s.domain === domain)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  const recent = inDomain.slice(0, HISTORY_WINDOW);
  const older = inDomain.slice(HISTORY_WINDOW, HISTORY_WINDOW * 2);

  const indicatorOf = (slice: PerformanceSample[]): number | null => {
    if (slice.length === 0) return null;
    // oldest→newest for the recency weighting to be meaningful.
    const ordered = [...slice].reverse();
    return Math.round(weightedMean(ordered.map(sessionIndicator)));
  };

  const recentScores = [...recent].reverse().map((s) => s.score);

  return {
    domain,
    current: indicatorOf(recent),
    previous: indicatorOf(older),
    trend: trendOf(recentScores),
    currentDifficulty: recent[0]?.difficulty ?? null,
  };
}

export interface WeeklySummaryInput {
  /** Completed sessions within the reporting week. */
  weekSessionCount: number;
  /** Distinct local days in the week with at least one activity. */
  activeDays: number;
  daysInWeek: number;
  /** Reminders due in the week and how many were acknowledged. */
  reminderTotal: number;
  reminderAcknowledged: number;
  /** Most-played activity name in the week, if any. */
  mostUsedActivity: string | null;
  domainTrends: WeeklyDomainTrend[];
}

export interface WeeklySummary extends WeeklySummaryInput {
  /** 0–100: share of the week's days with an activity completed. */
  completionConsistency: number;
  /** 0–100: share of due reminders acknowledged; null if none were due. */
  reminderCompletionRate: number | null;
}

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const completionConsistency =
    input.daysInWeek > 0
      ? Math.round((input.activeDays / input.daysInWeek) * 100)
      : 0;
  const reminderCompletionRate =
    input.reminderTotal > 0
      ? Math.round((input.reminderAcknowledged / input.reminderTotal) * 100)
      : null;
  return { ...input, completionConsistency, reminderCompletionRate };
}
