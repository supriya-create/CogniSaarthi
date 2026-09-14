import type { ReminderLogStatus } from "@prisma/client";

/**
 * OCCURRENCE STATE (pure and testable)
 * -----------------------------------------------------------------
 * A reminder occurrence moves through a small set of states derived
 * from its stored status, its scheduled instant and the current time.
 * Kept separate from the database so the rule ("when is something
 * missed?") is one tested function, not scattered across queries.
 */

/**
 * How long after the scheduled time an unacknowledged occurrence is
 * treated as missed. Three hours is gentle: a late breakfast does not
 * instantly become a "missed" event, but by mid-morning an untouched
 * 08:00 reminder is fairly counted.
 */
export const MISSED_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * The presentation state of an occurrence. `due` means "actionable
 * now"; `missed` means the time has well passed without an answer, but
 * the elder can still act on it — it is never an alarm.
 */
export type OccurrenceState =
  | "upcoming"
  | "due"
  | "done"
  | "skipped"
  | "snoozed"
  | "missed";

export interface OccurrenceInput {
  scheduledFor: Date;
  /** The stored log status, or null when no log exists yet (future). */
  status: ReminderLogStatus | null;
  snoozedUntil: Date | null;
}

export function classifyOccurrence(
  input: OccurrenceInput,
  now: Date,
  graceMs = MISSED_GRACE_MS,
): OccurrenceState {
  switch (input.status) {
    case "DONE":
      return "done";
    case "SKIPPED":
      return "skipped";
    case "MISSED":
      return "missed";
    case "SNOOZED":
      // A snooze that has elapsed becomes actionable again.
      if (input.snoozedUntil && now >= input.snoozedUntil) return "due";
      return "snoozed";
    case "PENDING":
    case null:
    default:
      if (input.scheduledFor > now) return "upcoming";
      if (now.getTime() - input.scheduledFor.getTime() > graceMs) {
        return "missed";
      }
      return "due";
  }
}

/** Whether an occurrence still wants an answer from the elder. */
export function isActionable(state: OccurrenceState): boolean {
  return state === "due" || state === "missed" || state === "snoozed";
}

/** Whether an occurrence counts as acknowledged (answered either way). */
export function isAcknowledged(status: ReminderLogStatus | null): boolean {
  return status === "DONE" || status === "SKIPPED";
}
