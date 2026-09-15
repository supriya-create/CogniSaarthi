import { describe, expect, it } from "vitest";

import {
  notificationKey,
  NOTIFY_WINDOW_MS,
  occurrencesToNotify,
  shouldNotifyForReminders,
  type NotifiableOccurrence,
} from "@/lib/notifications/schedule";
import type { OccurrenceState } from "@/lib/reminders/status";

const NOW = new Date("2026-09-15T09:00:00.000Z");

function at(minutesAgo: number, state: OccurrenceState): NotifiableOccurrence {
  return {
    reminderId: `r-${minutesAgo}-${state}`,
    scheduledFor: new Date(NOW.getTime() - minutesAgo * 60_000),
    state,
  };
}

describe("which occurrences earn a notification", () => {
  it("notifies for one that just came due", () => {
    const due = at(2, "due");
    expect(occurrencesToNotify([due], NOW)).toEqual([due]);
  });

  it("stays quiet for something not yet due", () => {
    expect(occurrencesToNotify([at(-30, "upcoming")], NOW)).toEqual([]);
  });

  it("stays quiet once an occurrence is older than the window", () => {
    // `due` lasts three hours, so without the window, opening the app
    // at noon would fire banners for everything since nine.
    const old = { ...at(0, "due") };
    old.scheduledFor = new Date(NOW.getTime() - NOTIFY_WINDOW_MS - 1000);
    expect(occurrencesToNotify([old], NOW)).toEqual([]);
  });

  it("includes one exactly at the window edge", () => {
    const edge = { ...at(0, "due") };
    edge.scheduledFor = new Date(NOW.getTime() - NOTIFY_WINDOW_MS);
    expect(occurrencesToNotify([edge], NOW)).toHaveLength(1);
  });

  it("never notifies for a missed occurrence", () => {
    // A banner hours late tells the one person least able to act on it
    // that they failed. The reminders screen shows it calmly instead.
    expect(occurrencesToNotify([at(5, "missed")], NOW)).toEqual([]);
  });

  it("never notifies for one already answered", () => {
    expect(occurrencesToNotify([at(5, "done")], NOW)).toEqual([]);
    expect(occurrencesToNotify([at(5, "skipped")], NOW)).toEqual([]);
  });

  it("never notifies while an occurrence is snoozed", () => {
    // They asked for later. classifyOccurrence returns it to `due` when
    // the snooze elapses, and it notifies then.
    expect(occurrencesToNotify([at(5, "snoozed")], NOW)).toEqual([]);
  });

  it("tolerates a clock that is behind", () => {
    const future = { ...at(0, "due") };
    future.scheduledFor = new Date(NOW.getTime() + 60_000);
    expect(occurrencesToNotify([future], NOW)).toEqual([]);
  });
});

describe("not notifying twice for the same occurrence", () => {
  it("skips one already notified", () => {
    const due = at(2, "due");
    const seen = new Set([notificationKey(due)]);
    expect(occurrencesToNotify([due], NOW, seen)).toEqual([]);
  });

  it("keys an occurrence by reminder and instant", () => {
    const due = at(2, "due");
    expect(notificationKey(due)).toBe(
      `${due.reminderId}|${due.scheduledFor.toISOString()}`,
    );
  });

  it("treats two occurrences of one reminder as separate", () => {
    const morning = { ...at(2, "due"), reminderId: "same" };
    const evening = { ...at(10, "due"), reminderId: "same" };
    expect(notificationKey(morning)).not.toBe(notificationKey(evening));
  });
});

describe("shouldNotifyForReminders", () => {
  it("is true when anything qualifies", () => {
    expect(shouldNotifyForReminders([at(1, "due")], NOW)).toBe(true);
  });

  it("is false for an empty day", () => {
    expect(shouldNotifyForReminders([], NOW)).toBe(false);
  });

  it("is false when everything is answered or out of window", () => {
    expect(
      shouldNotifyForReminders([at(5, "done"), at(200, "missed")], NOW),
    ).toBe(false);
  });
});
