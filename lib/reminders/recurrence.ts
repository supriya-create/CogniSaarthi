import type { RecurrenceType } from "@prisma/client";

import {
  addDays,
  dayIndex,
  daysInMonth,
  DAY_MS,
  localDayOf,
  type LocalDay,
  weekdayOf,
  zonedTimeToUtc,
} from "@/lib/reminders/timezone";

/**
 * RECURRENCE (pure and testable)
 * -----------------------------------------------------------------
 * Turns a reminder DEFINITION into the concrete UTC instants it fires
 * at, inside a window. Deliberately not a general scheduling engine:
 * four patterns (once / daily / weekly-with-weekday-set / monthly) plus
 * a wall-clock time cover a daily routine, and every occurrence is a
 * plain `zonedTimeToUtc` of a local day. No dependency on Prisma or the
 * database, so it is unit-tested like the Phase 2 performance engine.
 */

/** Just the scheduling fields the engine needs, decoupled from Prisma. */
export interface ReminderSchedule {
  /** Minutes past local midnight, 0–1439. */
  timeMinutes: number;
  recurrence: RecurrenceType;
  /** Weekdays that fire for WEEKLY, 0 (Sun) … 6 (Sat). */
  weekdays: number[];
  /** Day of month for MONTHLY, 1–31 (clamped to the month's length). */
  monthDay: number | null;
  /** Local calendar day the schedule begins (also the exact day for ONCE). */
  startDate: Date;
  /** Optional last local calendar day a recurring reminder fires. */
  endDate: Date | null;
}

/** Whether a schedule fires on a particular local day. */
export function firesOn(
  schedule: ReminderSchedule,
  day: LocalDay,
  timeZone: string,
): boolean {
  const start = localDayOf(schedule.startDate, timeZone);
  if (dayIndex(day) < dayIndex(start)) return false;
  if (schedule.endDate) {
    const end = localDayOf(schedule.endDate, timeZone);
    if (dayIndex(day) > dayIndex(end)) return false;
  }

  switch (schedule.recurrence) {
    case "ONCE":
      return dayIndex(day) === dayIndex(start);
    case "DAILY":
      return true;
    case "WEEKLY":
      return schedule.weekdays.includes(weekdayOf(day));
    case "MONTHLY": {
      const target = schedule.monthDay ?? start.day;
      const clamped = Math.min(target, daysInMonth(day.year, day.month));
      return day.day === clamped;
    }
    default:
      return false;
  }
}

/**
 * Every occurrence instant in the half-open window `[from, to)`.
 * Returned oldest-first. The window is expected to be small (a day, a
 * week), so a day-by-day scan is more than fast enough and keeps the
 * logic obvious.
 */
export function occurrencesBetween(
  schedule: ReminderSchedule,
  from: Date,
  to: Date,
  timeZone: string,
): Date[] {
  if (to <= from) return [];

  const start = localDayOf(schedule.startDate, timeZone);
  // Begin scanning a day early so an occurrence late on the day before
  // `from`'s local day is never skipped, then filter by the instant.
  let cursor = localDayOf(new Date(from.getTime() - DAY_MS), timeZone);
  if (dayIndex(cursor) < dayIndex(start)) cursor = start;

  const lastDay = localDayOf(to, timeZone);
  const result: Date[] = [];

  // Hard cap: a wide window on a daily reminder is still bounded.
  for (let guard = 0; guard < 1000; guard++) {
    if (dayIndex(cursor) > dayIndex(lastDay)) break;
    if (firesOn(schedule, cursor, timeZone)) {
      const instant = zonedTimeToUtc(cursor, schedule.timeMinutes, timeZone);
      if (instant >= from && instant < to) result.push(instant);
    }
    cursor = addDays(cursor, 1);
  }

  return result;
}

/**
 * The first occurrence strictly after `after`, or null if none within
 * `horizonDays`. Used for "next up" copy and upcoming-reminder alerts.
 */
export function nextOccurrence(
  schedule: ReminderSchedule,
  after: Date,
  timeZone: string,
  horizonDays = 62,
): Date | null {
  const to = new Date(after.getTime() + horizonDays * DAY_MS);
  const occurrences = occurrencesBetween(
    schedule,
    new Date(after.getTime() + 1),
    to,
    timeZone,
  );
  return occurrences[0] ?? null;
}

/** Format minutes-past-midnight as "HH:MM" (24-hour). */
export function formatTimeMinutes(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Parse "HH:MM" into minutes past midnight, or null if malformed. */
export function parseTimeMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}
