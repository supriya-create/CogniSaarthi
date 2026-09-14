import { describe, expect, it } from "vitest";

import {
  formatTimeMinutes,
  nextOccurrence,
  occurrencesBetween,
  parseTimeMinutes,
  type ReminderSchedule,
} from "@/lib/reminders/recurrence";
import { localDayOf, weekdayOf, zonedTimeToUtc } from "@/lib/reminders/timezone";

const TZ = "Asia/Kolkata";

function schedule(partial: Partial<ReminderSchedule>): ReminderSchedule {
  return {
    timeMinutes: 8 * 60, // 08:00
    recurrence: "DAILY",
    weekdays: [],
    monthDay: null,
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: null,
    ...partial,
  };
}

/** Local midnight (as a UTC instant) of a YYYY-MM-DD in the app zone. */
function dayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return zonedTimeToUtc({ year: y, month: m, day: d }, 0, TZ);
}

describe("time parsing", () => {
  it("formats minutes-past-midnight", () => {
    expect(formatTimeMinutes(0)).toBe("00:00");
    expect(formatTimeMinutes(8 * 60)).toBe("08:00");
    expect(formatTimeMinutes(17 * 60 + 30)).toBe("17:30");
  });
  it("parses HH:MM and rejects nonsense", () => {
    expect(parseTimeMinutes("8:00")).toBe(480);
    expect(parseTimeMinutes("17:30")).toBe(1050);
    expect(parseTimeMinutes("25:00")).toBeNull();
    expect(parseTimeMinutes("08:99")).toBeNull();
    expect(parseTimeMinutes("morning")).toBeNull();
  });
});

describe("timezone wall-clock", () => {
  it("keeps 08:00 IST at 02:30 UTC", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 480, TZ);
    expect(instant.toISOString()).toBe("2026-09-14T02:30:00.000Z");
  });
  it("round-trips to the same local day", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 30, TZ);
    expect(localDayOf(instant, TZ)).toEqual({ year: 2026, month: 9, day: 14 });
  });
});

describe("occurrencesBetween", () => {
  it("ONCE fires exactly on its start day", () => {
    const s = schedule({
      recurrence: "ONCE",
      startDate: new Date("2026-09-14T00:00:00Z"),
    });
    const onDay = occurrencesBetween(
      s,
      dayStart("2026-09-14"),
      dayStart("2026-09-15"),
      TZ,
    );
    expect(onDay).toHaveLength(1);
    expect(onDay[0].toISOString()).toBe("2026-09-14T02:30:00.000Z");

    const otherDay = occurrencesBetween(
      s,
      dayStart("2026-09-15"),
      dayStart("2026-09-16"),
      TZ,
    );
    expect(otherDay).toHaveLength(0);
  });

  it("DAILY fires once per day across the window", () => {
    const s = schedule({ recurrence: "DAILY" });
    const occ = occurrencesBetween(
      s,
      dayStart("2026-09-10"),
      dayStart("2026-09-13"),
      TZ,
    );
    expect(occ).toHaveLength(3);
  });

  it("WEEKLY Mon–Fri fires 10 times over two weeks", () => {
    const s = schedule({ recurrence: "WEEKLY", weekdays: [1, 2, 3, 4, 5] });
    const from = dayStart("2026-09-07");
    const to = dayStart("2026-09-21"); // exactly 14 days
    const occ = occurrencesBetween(s, from, to, TZ);
    expect(occ).toHaveLength(10);
    // None of them land on a weekend.
    for (const instant of occ) {
      const weekday = weekdayOf(localDayOf(instant, TZ));
      expect(weekday).not.toBe(0);
      expect(weekday).not.toBe(6);
    }
  });

  it("MONTHLY fires on its day each month", () => {
    const s = schedule({ recurrence: "MONTHLY", monthDay: 15 });
    const occ = occurrencesBetween(
      s,
      dayStart("2026-09-01"),
      dayStart("2026-11-01"),
      TZ,
    );
    expect(occ).toHaveLength(2);
    expect(occ.map((o) => localDayOf(o, TZ).day)).toEqual([15, 15]);
  });

  it("respects startDate and endDate", () => {
    const s = schedule({
      recurrence: "DAILY",
      startDate: new Date("2026-09-10T00:00:00Z"),
      endDate: new Date("2026-09-12T00:00:00Z"),
    });
    const occ = occurrencesBetween(
      s,
      dayStart("2026-09-08"),
      dayStart("2026-09-20"),
      TZ,
    );
    expect(occ).toHaveLength(3); // 10, 11, 12 inclusive
  });

  it("is half-open: excludes an occurrence exactly at `to`", () => {
    const s = schedule({ recurrence: "DAILY" });
    const from = dayStart("2026-09-10");
    const to = new Date("2026-09-11T02:30:00.000Z"); // the 11th's instant
    const occ = occurrencesBetween(s, from, to, TZ);
    // 10th is included, 11th's 08:00 is exactly `to` and excluded.
    expect(occ).toHaveLength(1);
  });
});

describe("nextOccurrence", () => {
  it("finds the next daily instance after a moment", () => {
    const s = schedule({ recurrence: "DAILY" });
    const after = new Date("2026-09-14T05:00:00Z"); // past today's 02:30
    const next = nextOccurrence(s, after, TZ);
    expect(next?.toISOString()).toBe("2026-09-15T02:30:00.000Z");
  });
  it("returns null when a ONCE reminder is already past", () => {
    const s = schedule({
      recurrence: "ONCE",
      startDate: new Date("2026-09-01T00:00:00Z"),
    });
    expect(nextOccurrence(s, new Date("2026-09-05T00:00:00Z"), TZ)).toBeNull();
  });
});
