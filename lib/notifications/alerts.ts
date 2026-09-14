import type { AlertSeverity, CognitiveDomain } from "@prisma/client";

import type { Trend } from "@/lib/cognitive-performance/types";
import { localDayOf } from "@/lib/reminders/timezone";
import type { AlertDescriptor } from "@/lib/notifications/types";

/**
 * ALERT DERIVATION (pure and testable)
 * -----------------------------------------------------------------
 * From a snapshot of one elder's day to a SHORT list of caregiver
 * alerts. The governing rule is signal, not noise: at most one alert
 * per condition, thresholds that ignore ordinary variation, and copy
 * that is neutral and non-medical by construction.
 *
 * Nothing here diagnoses. A declining trend becomes "activities have
 * been more challenging recently" (ATTENTION), never "deteriorating".
 * Missed reminders become "were not acknowledged", never "did not take
 * her medicine" — the app cannot know that.
 *
 * The reused inputs (trend, indicator) come straight from the Phase 2
 * performance engine; this module does not compute a second score.
 */

/** Per-domain slice of the performance picture (from Phase 2). */
export interface DomainSignal {
  domain: CognitiveDomain;
  trend: Trend;
  /** Recency-weighted indicator now, 0–100; null in cold start. */
  indicatorNow: number | null;
  /** Indicator over the earlier half of the window; null if unknown. */
  indicatorBaseline: number | null;
  coldStart: boolean;
}

export interface AlertContext {
  now: Date;
  timeZone: string;
  /** Reminders due today and how many went unacknowledged past grace. */
  missedToday: number;
  missedImportantToday: number;
  /** Whole days since the last completed activity; null if never. */
  daysSinceLastActivity: number | null;
  completedToday: number;
  dailyGoal: number;
  domains: DomainSignal[];
}

// A meaningful drop in the ability indicator before a change is even
// considered — smaller swings are normal and never raise an alert.
const PERFORMANCE_DROP_POINTS = 8;
// Days of no activity before it is worth a gentle nudge.
const INACTIVITY_ATTENTION_DAYS = 3;
const INACTIVITY_IMPORTANT_DAYS = 6;

const DOMAIN_WORD: Record<CognitiveDomain, string> = {
  SHORT_TERM_MEMORY: "Memory",
  ATTENTION: "Attention",
  WORKING_MEMORY: "Working memory",
  LANGUAGE: "Language",
  PROCESSING_SPEED: "Processing speed",
  EXECUTIVE_FUNCTION: "Planning",
};

/** Local YYYY-MM-DD, for per-day dedupe keys. */
function localDateKey(now: Date, timeZone: string): string {
  const d = localDayOf(now, timeZone);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${p(d.month)}-${p(d.day)}`;
}

/** ISO-ish week stamp, for per-week dedupe of slow-moving signals. */
function weekKey(now: Date, timeZone: string): string {
  const d = localDayOf(now, timeZone);
  const epochDay = Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
  return `w${Math.floor(epochDay / 7)}`;
}

export function deriveAlerts(context: AlertContext): AlertDescriptor[] {
  const alerts: AlertDescriptor[] = [];
  const dayKey = localDateKey(context.now, context.timeZone);

  // --- Missed reminders: one alert, strongest applicable severity. ---
  if (context.missedToday > 0) {
    let severity: AlertSeverity = "INFO";
    let title = "A reminder was not acknowledged";
    let body =
      "A scheduled reminder was not marked done, skipped or snoozed today.";

    if (context.missedToday >= 3) {
      severity = "IMPORTANT";
      title = "Several reminders were not acknowledged";
      body = `${context.missedToday} scheduled reminders were not acknowledged today.`;
    } else if (context.missedImportantToday > 0 || context.missedToday >= 2) {
      severity = "ATTENTION";
      title = "Reminders were not acknowledged";
      body =
        context.missedImportantToday > 0
          ? "An important reminder was not acknowledged today."
          : "Some reminders were not acknowledged today.";
    }

    // Only surface a single missed reminder as an alert when it was
    // marked important; a lone ordinary miss is not caregiver-worthy.
    const worthShowing =
      context.missedToday >= 2 || context.missedImportantToday > 0;
    if (worthShowing) {
      alerts.push({
        type: "REMINDER_MISSED",
        severity,
        title,
        body,
        dedupeKey: `missed:${dayKey}`,
      });
    }
  }

  // --- Inactivity: gentle, and only after a real gap. ---
  if (
    context.daysSinceLastActivity !== null &&
    context.daysSinceLastActivity >= INACTIVITY_ATTENTION_DAYS
  ) {
    const important =
      context.daysSinceLastActivity >= INACTIVITY_IMPORTANT_DAYS;
    alerts.push({
      type: "INACTIVITY",
      severity: important ? "IMPORTANT" : "ATTENTION",
      title: "Activities have paused",
      body: `No activities have been completed in the last ${context.daysSinceLastActivity} days.`,
      dedupeKey: `inactivity:${dayKey}`,
    });
  }

  // --- Performance change: neutral, per declining domain, per week. ---
  for (const d of context.domains) {
    if (d.coldStart) continue;
    const dropped =
      d.indicatorNow !== null &&
      d.indicatorBaseline !== null &&
      d.indicatorBaseline - d.indicatorNow >= PERFORMANCE_DROP_POINTS;
    if (d.trend === "declining" && dropped) {
      alerts.push({
        type: "PERFORMANCE_CHANGE",
        severity: "ATTENTION",
        title: `${DOMAIN_WORD[d.domain]} activities have been more challenging`,
        body: `${DOMAIN_WORD[d.domain]} activities have been a little harder than usual over recent sessions. This is only how the activities went, not a health measurement.`,
        dedupeKey: `perf:${d.domain}:${weekKey(context.now, context.timeZone)}`,
      });
    }
  }

  // --- Daily complete: a warm, informational note. ---
  if (context.completedToday >= context.dailyGoal && context.dailyGoal > 0) {
    alerts.push({
      type: "DAILY_COMPLETE",
      severity: "INFO",
      title: "Today's activities are complete",
      body: `All ${context.dailyGoal} activities for today have been completed.`,
      dedupeKey: `complete:${dayKey}`,
    });
  }

  return alerts;
}

/** Numeric rank so a caregiver list can lead with the strongest. */
export function severityRank(severity: AlertSeverity): number {
  return { IMPORTANT: 3, ATTENTION: 2, INFO: 1 }[severity];
}
