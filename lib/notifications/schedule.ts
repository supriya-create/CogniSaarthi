import type { OccurrenceState } from "@/lib/reminders/status";

/**
 * NOTIFICATIONS — which occurrences deserve one (pure).
 * -----------------------------------------------------------------
 * This module decides NOTHING about when a reminder happens. That is
 * `lib/reminders/recurrence.ts` (when it fires) and
 * `lib/reminders/status.ts` (what state it is in), and both are reused
 * unchanged — a second copy of the schedule would be a second thing to
 * keep correct, and the two would eventually disagree.
 *
 * All this answers is the narrower question: given occurrences that
 * have already been classified, which ones should interrupt somebody?
 */

/**
 * How recently an occurrence must have come due to be worth a banner.
 *
 * Fifteen minutes, because the alternative is worse than it sounds. An
 * occurrence stays `due` for three hours (MISSED_GRACE_MS), so without
 * this window, opening the app at noon would fire notifications for
 * everything since nine — a stack of banners for things already
 * visible on the screen. For somebody with memory difficulty that is
 * not a reminder, it is a pile of unexplained alerts.
 *
 * So a notification marks a TRANSITION: this just became due.
 */
export const NOTIFY_WINDOW_MS = 15 * 60 * 1000;

export interface NotifiableOccurrence {
  reminderId: string;
  scheduledFor: Date;
  state: OccurrenceState;
}

/** Stable identity for one occurrence, matching the offline layer's. */
export function notificationKey(occurrence: NotifiableOccurrence): string {
  return `${occurrence.reminderId}|${occurrence.scheduledFor.toISOString()}`;
}

/**
 * The occurrences that should produce a notification right now.
 *
 * Deliberately excludes:
 *
 *  - `missed` — a banner three hours late says "you failed to do this"
 *    to the one person least able to act on that, and the reminders
 *    screen already shows it calmly.
 *  - `snoozed` — they asked for later. When the snooze elapses
 *    `classifyOccurrence` returns it to `due` and it notifies then.
 *  - `done` / `skipped` — answered.
 *  - `upcoming` — not yet.
 */
export function occurrencesToNotify(
  occurrences: NotifiableOccurrence[],
  now: Date,
  alreadyNotified: ReadonlySet<string> = new Set(),
): NotifiableOccurrence[] {
  return occurrences.filter((occurrence) => {
    if (occurrence.state !== "due") return false;

    const age = now.getTime() - occurrence.scheduledFor.getTime();
    // Not yet due (clock skew), or due too long ago to interrupt for.
    if (age < 0 || age > NOTIFY_WINDOW_MS) return false;

    return !alreadyNotified.has(notificationKey(occurrence));
  });
}

/**
 * Whether anything at all is worth notifying about.
 *
 * The caller shows ONE notification regardless of how many occurrences
 * qualify — the payload carries no content, so three banners saying
 * "Your reminder is ready" would convey nothing a single one does not,
 * while being three times as alarming.
 */
export function shouldNotifyForReminders(
  occurrences: NotifiableOccurrence[],
  now: Date,
  alreadyNotified: ReadonlySet<string> = new Set(),
): boolean {
  return occurrencesToNotify(occurrences, now, alreadyNotified).length > 0;
}
