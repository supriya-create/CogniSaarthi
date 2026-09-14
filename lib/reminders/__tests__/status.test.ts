import { describe, expect, it } from "vitest";

import {
  classifyOccurrence,
  isAcknowledged,
  isActionable,
  MISSED_GRACE_MS,
} from "@/lib/reminders/status";

const NOW = new Date("2026-09-14T06:00:00Z");

describe("classifyOccurrence", () => {
  it("reflects a terminal stored status", () => {
    const base = { snoozedUntil: null };
    expect(
      classifyOccurrence({ ...base, scheduledFor: NOW, status: "DONE" }, NOW),
    ).toBe("done");
    expect(
      classifyOccurrence({ ...base, scheduledFor: NOW, status: "SKIPPED" }, NOW),
    ).toBe("skipped");
    expect(
      classifyOccurrence({ ...base, scheduledFor: NOW, status: "MISSED" }, NOW),
    ).toBe("missed");
  });

  it("is upcoming before the time and due within the grace window", () => {
    const soon = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(
      classifyOccurrence(
        { scheduledFor: soon, status: null, snoozedUntil: null },
        NOW,
      ),
    ).toBe("upcoming");

    const justPast = new Date(NOW.getTime() - 30 * 60 * 1000);
    expect(
      classifyOccurrence(
        { scheduledFor: justPast, status: "PENDING", snoozedUntil: null },
        NOW,
      ),
    ).toBe("due");
  });

  it("becomes missed only after the grace window", () => {
    const longPast = new Date(NOW.getTime() - MISSED_GRACE_MS - 1000);
    expect(
      classifyOccurrence(
        { scheduledFor: longPast, status: null, snoozedUntil: null },
        NOW,
      ),
    ).toBe("missed");
  });

  it("resurfaces a snooze once it has elapsed", () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(
      classifyOccurrence(
        { scheduledFor: NOW, status: "SNOOZED", snoozedUntil: past },
        NOW,
      ),
    ).toBe("due");

    const future = new Date(NOW.getTime() + 1000);
    expect(
      classifyOccurrence(
        { scheduledFor: NOW, status: "SNOOZED", snoozedUntil: future },
        NOW,
      ),
    ).toBe("snoozed");
  });
});

describe("helpers", () => {
  it("marks due/missed/snoozed as actionable", () => {
    expect(isActionable("due")).toBe(true);
    expect(isActionable("missed")).toBe(true);
    expect(isActionable("snoozed")).toBe(true);
    expect(isActionable("done")).toBe(false);
    expect(isActionable("upcoming")).toBe(false);
  });
  it("counts done and skipped as acknowledged", () => {
    expect(isAcknowledged("DONE")).toBe(true);
    expect(isAcknowledged("SKIPPED")).toBe(true);
    expect(isAcknowledged("MISSED")).toBe(false);
    expect(isAcknowledged(null)).toBe(false);
  });
});
