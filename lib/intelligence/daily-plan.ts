import { HISTORY_WINDOW } from "@/lib/cognitive-performance/config";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import {
  EFFORT_HINT_RATE,
  EFFORT_MIN_SESSIONS,
  EFFORT_SCORE_BELOW,
  PLAN_SIZE_NORMAL,
  PLAN_SIZE_SHORT,
  RETURNING_AFTER_DAYS,
} from "@/lib/intelligence/config";
import { rankActivities, type RecommendationContext } from "@/lib/intelligence/recommendations";
import type { DailyPlan } from "@/lib/intelligence/types";

/**
 * THE DAILY PLAN (pure)
 * -----------------------------------------------------------------
 * Turns the ranked activities into a day: a short ordered list, plus
 * one optional extra for somebody who wants to keep going.
 *
 * Two principles shape it:
 *
 *  1. It is a SUGGESTION, never a quota. Nothing is failed by not
 *     finishing it, and the extra is explicitly optional — a person who
 *     does one activity has had a good day.
 *  2. It gets SHORTER, not longer, when things look hard. If recent
 *     sessions leaned on hints or ran low, or somebody is coming back
 *     after a gap, the day asks less of them.
 */

/**
 * Effort signals from recent play. This is NOT fatigue and is never
 * called that — it is a read on how the exercises themselves went,
 * requiring several sessions so one bad morning cannot trigger it.
 */
export function looksEffortful(samples: PerformanceSample[]): boolean {
  const recent = [...samples]
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, HISTORY_WINDOW);

  if (recent.length < EFFORT_MIN_SESSIONS) return false;

  const meanScore =
    recent.reduce((sum, s) => sum + s.score, 0) / recent.length;

  const hintRate =
    recent.reduce(
      (sum, s) => sum + (s.roundsTotal > 0 ? s.hints / s.roundsTotal : 0),
      0,
    ) / recent.length;

  return meanScore < EFFORT_SCORE_BELOW || hintRate > EFFORT_HINT_RATE;
}

export interface DailyPlanInput extends RecommendationContext {
  /** Completed activities so far today. */
  completedToday: number;
  /** Recent sessions, for the effort read. */
  recentSamples: PerformanceSample[];
}

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const ranked = rankActivities(input);

  const effortful = looksEffortful(input.recentSamples);
  const returning =
    input.routine.daysSinceLastActivity !== null &&
    input.routine.daysSinceLastActivity >= RETURNING_AFTER_DAYS;

  // A lighter day when the exercises have been hard work, or when
  // somebody is easing back in after a gap.
  const gentler = effortful || returning;
  const size = gentler ? PLAN_SIZE_SHORT : PLAN_SIZE_NORMAL;

  const activities = ranked.slice(0, size);
  const optionalExtra = ranked[size] ?? null;

  return {
    shape: gentler ? "SHORT" : "NORMAL",
    activities,
    optionalExtra,
    completedToday: input.completedToday,
    // Nothing left to suggest means the day's plan is done — which is
    // a congratulation, not a target that was met.
    complete: activities.length === 0,
    gentler,
  };
}
