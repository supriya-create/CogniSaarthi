/**
 * The product is built for the North East of India, so "today" and
 * "morning" are anchored to Indian Standard Time rather than to
 * whatever timezone the server happens to run in. This keeps the
 * greeting and the daily progress count consistent between the
 * elderly device and the caregiver's dashboard.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

/** Midnight IST of the day `date` falls on, as a UTC instant. */
export function startOfDay(date: Date = new Date()): Date {
  const { year, month, day } = zonedParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00+05:30`);
}

export type GreetingKey =
  | "greetingMorning"
  | "greetingAfternoon"
  | "greetingEvening";

export function greetingKey(date: Date = new Date()): GreetingKey {
  const { hour } = zonedParts(date);
  if (hour < 12) return "greetingMorning";
  if (hour < 17) return "greetingAfternoon";
  return "greetingEvening";
}

export function isToday(date: Date): boolean {
  return date >= startOfDay();
}

export function formatDayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * "1 min 20 sec" style duration, written out rather than mm:ss —
 * a colon-separated stopwatch reading is a convention, and a
 * convention is one more thing to have to know.
 *
 * Units are passed in so the elderly interface can say them in the
 * person's own language.
 */
export function formatDuration(
  ms: number,
  units: { minute: string; second: string } = { minute: "min", second: "sec" },
): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} ${units.second}`;
  return `${minutes} ${units.minute} ${seconds} ${units.second}`;
}
