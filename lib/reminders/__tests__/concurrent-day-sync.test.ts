import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { syncReminderDay } from "@/lib/reminders/sync";
import { MISSED_GRACE_MS } from "@/lib/reminders/status";

/**
 * TWO REQUESTS AT ONCE.
 *
 * Reminder occurrences are materialised lazily — there is no cron — so
 * the first thing to open the app writes today's MISSED markers. That
 * is routinely more than one thing at a time: a page render, its RSC
 * fetch, and the caregiver dashboard's alert sync all reach for the
 * same rows within milliseconds of each other.
 *
 * This was a real failure, found by driving a real browser against the
 * production build: two concurrent renders both wrote the same
 * occurrence, one lost the unique constraint, and the P2002 took a
 * page render down with it. It is asserted here because the fix is
 * invisible by inspection — an `upsert` with an empty `update` LOOKS
 * atomic and is not.
 */

const TAG = `concurrent-${Date.now()}`;
let userId = "";
let reminderId = "";

/** Well past the grace window, so the MISSED path definitely runs. */
const NOW = new Date();
const SCHEDULED_HOUR = 6;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: `${TAG}-user`,
      connectCode: `${TAG}`.slice(0, 40),
      preference: { create: { timeZone: "UTC" } },
    },
  });

  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id,
      title: `${TAG}-reminder`,
      category: "DAILY_ROUTINE",
      priority: "NORMAL",
      timeMinutes: SCHEDULED_HOUR * 60,
      recurrence: "DAILY",
      startDate: new Date(NOW.getTime() - 30 * 86_400_000),
      enabled: true,
    },
  });

  userId = user.id;
  reminderId = reminder.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("materialising the day from several requests at once", () => {
  it("does not throw, and writes exactly one row per occurrence", async () => {
    // Late enough in the (UTC) day that the 06:00 occurrence is well
    // past the grace window whenever this test runs.
    const now = new Date(NOW);
    now.setUTCHours(23, 0, 0, 0);
    expect(now.getTime() - new Date(now).setUTCHours(SCHEDULED_HOUR, 0, 0, 0))
      .toBeGreaterThan(MISSED_GRACE_MS);

    const runs = await Promise.all([
      syncReminderDay(userId, "UTC", now),
      syncReminderDay(userId, "UTC", now),
      syncReminderDay(userId, "UTC", now),
      syncReminderDay(userId, "UTC", now),
    ]);

    // All four return the same day, and none of them rejected.
    for (const day of runs) {
      expect(day.map((item) => item.state)).toEqual(["missed"]);
    }

    expect(
      await prisma.reminderLog.count({ where: { reminderId } }),
    ).toBe(1);
  });

  it("never replaces an answer that landed first", async () => {
    const now = new Date(NOW);
    now.setUTCHours(23, 30, 0, 0);

    // Whoever answered wins; a later sync must not overwrite it with
    // MISSED just because it looks overdue.
    await prisma.reminderLog.updateMany({
      where: { reminderId },
      data: { status: "DONE", acknowledgedAt: now },
    });

    await Promise.all([
      syncReminderDay(userId, "UTC", now),
      syncReminderDay(userId, "UTC", now),
    ]);

    const logs = await prisma.reminderLog.findMany({ where: { reminderId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("DONE");
  });
});
