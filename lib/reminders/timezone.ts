/**
 * TIMEZONE HELPERS FOR REMINDER SCHEDULING (pure, no database)
 * -----------------------------------------------------------------
 * Reminders are wall-clock things: "08:00 medication" must stay at
 * 08:00 in the person's own timezone, not drift with the server or an
 * assumed UTC. These helpers convert between a local wall-clock time
 * (year/month/day + minutes past midnight, in a named IANA zone) and
 * the absolute UTC instant we store on a ReminderLog.
 *
 * The app's home region (Asia/Kolkata) has no daylight saving, but the
 * conversion is written to be correct for zones that do, so a future
 * user in another zone is handled rather than assumed away.
 */

export const DAY_MS = 86_400_000;

/** A local calendar day, timezone-agnostic on its own. */
export interface LocalDay {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

/**
 * Offset (ms) such that `local = utc + offset` at the given instant in
 * the given zone. Uses the well-known locale round-trip so it needs no
 * timezone database beyond the one Intl already ships.
 */
function offsetMs(instant: Date, timeZone: string): number {
  const asUtc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  const asZoned = new Date(instant.toLocaleString("en-US", { timeZone }));
  return asZoned.getTime() - asUtc.getTime();
}

/**
 * The UTC instant for a wall-clock time in a zone. `minutes` is minutes
 * past local midnight (0–1439). Refines once so a DST-boundary time
 * lands on the correct side of the jump.
 */
export function zonedTimeToUtc(
  day: LocalDay,
  minutes: number,
  timeZone: string,
): Date {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const guess = new Date(Date.UTC(day.year, day.month - 1, day.day, hh, mm));
  const off = offsetMs(guess, timeZone);
  const utc = new Date(guess.getTime() - off);
  const off2 = offsetMs(utc, timeZone);
  return off2 === off ? utc : new Date(guess.getTime() - off2);
}

/** The local calendar day + minutes-past-midnight an instant falls on. */
export function zonedParts(
  instant: Date,
  timeZone: string,
): LocalDay & { minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl can render midnight as hour 24; fold it back to 0.
  const hour = get("hour") % 24;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    minutes: hour * 60 + get("minute"),
  };
}

/** The local calendar day an instant falls on, in the given zone. */
export function localDayOf(instant: Date, timeZone: string): LocalDay {
  const { year, month, day } = zonedParts(instant, timeZone);
  return { year, month, day };
}

/**
 * Weekday of a calendar day, 0 (Sunday) … 6 (Saturday). A calendar
 * date has one weekday regardless of zone, so this is computed from the
 * date alone.
 */
export function weekdayOf(day: LocalDay): number {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

/** A sortable integer for a local day (its UTC-midnight epoch). */
export function dayIndex(day: LocalDay): number {
  return Date.UTC(day.year, day.month - 1, day.day);
}

/** The local day `n` days after `day` (n may be negative). */
export function addDays(day: LocalDay, n: number): LocalDay {
  const d = new Date(dayIndex(day) + n * DAY_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** Number of days in a given month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
