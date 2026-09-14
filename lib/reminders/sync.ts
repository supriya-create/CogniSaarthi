import "server-only";

import type {
  ReminderCategory,
  ReminderPriority,
  ReminderLogStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getEnabledRemindersForUser, toSchedule } from "@/lib/reminders/queries";
import { occurrencesBetween } from "@/lib/reminders/recurrence";
import {
  classifyOccurrence,
  isAcknowledged,
  MISSED_GRACE_MS,
  type OccurrenceState,
} from "@/lib/reminders/status";
import {
  addDays,
  localDayOf,
  zonedTimeToUtc,
} from "@/lib/reminders/timezone";

/**
 * Reminder occurrences are materialised LAZILY — there is no cron. When
 * a reminder view is opened, this recomputes today's occurrences from
 * the definitions, marks any that are well past their time without an
 * answer as MISSED, and returns the day for rendering. Acknowledged and
 * snoozed occurrences already have a log; upcoming ones do not yet.
 */

export interface ReminderDayItem {
  reminderId: string;
  logId: string | null;
  title: string;
  description: string | null;
  category: ReminderCategory;
  priority: ReminderPriority;
  /** The exact UTC instant this occurrence is scheduled for. */
  scheduledFor: Date;
  timeMinutes: number;
  status: ReminderLogStatus | null;
  state: OccurrenceState;
}

function occurrenceKey(reminderId: string, scheduledFor: Date): string {
  return `${reminderId}|${scheduledFor.toISOString()}`;
}

/** The [start, end) UTC bounds of the local day `now` falls on. */
export function localDayBounds(now: Date, timeZone: string): [Date, Date] {
  const today = localDayOf(now, timeZone);
  const start = zonedTimeToUtc(today, 0, timeZone);
  const end = zonedTimeToUtc(addDays(today, 1), 0, timeZone);
  return [start, end];
}

/**
 * Recompute today's reminder occurrences, persist MISSED for those that
 * have gone unanswered past the grace window, and return the day.
 */
export async function syncReminderDay(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<ReminderDayItem[]> {
  const reminders = await getEnabledRemindersForUser(userId);
  const [dayStart, dayEnd] = localDayBounds(now, timeZone);

  const logs = await prisma.reminderLog.findMany({
    where: {
      userId,
      scheduledFor: { gte: dayStart, lt: dayEnd },
    },
  });
  const logByKey = new Map(
    logs.map((log) => [occurrenceKey(log.reminderId, log.scheduledFor), log]),
  );

  const items: ReminderDayItem[] = [];

  for (const reminder of reminders) {
    const occurrences = occurrencesBetween(
      toSchedule(reminder),
      dayStart,
      dayEnd,
      timeZone,
    );

    for (const scheduledFor of occurrences) {
      const key = occurrenceKey(reminder.id, scheduledFor);
      let log = logByKey.get(key) ?? null;

      const overdue =
        now.getTime() - scheduledFor.getTime() > MISSED_GRACE_MS;

      // Persist a MISSED marker for an unanswered, well-overdue slot so
      // the caregiver summary and alerts can count it even if the elder
      // never opens the app. Never overwrites a real answer.
      if (!log && overdue) {
        log = await prisma.reminderLog.upsert({
          where: {
            reminderId_scheduledFor: {
              reminderId: reminder.id,
              scheduledFor,
            },
          },
          create: {
            reminderId: reminder.id,
            userId,
            scheduledFor,
            status: "MISSED",
          },
          update: {},
        });
      }

      const state = classifyOccurrence(
        {
          scheduledFor,
          status: log?.status ?? null,
          snoozedUntil: log?.snoozedUntil ?? null,
        },
        now,
      );

      items.push({
        reminderId: reminder.id,
        logId: log?.id ?? null,
        title: reminder.title,
        description: reminder.description,
        category: reminder.category,
        priority: reminder.priority,
        scheduledFor,
        timeMinutes: reminder.timeMinutes,
        status: log?.status ?? null,
        state,
      });
    }
  }

  return items.sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime(),
  );
}

export interface ReminderDayStats {
  total: number;
  acknowledged: number;
  missed: number;
  missedImportant: number;
}

/** Aggregate today's occurrences for summaries and alerts. */
export function statsForDay(items: ReminderDayItem[]): ReminderDayStats {
  let acknowledged = 0;
  let missed = 0;
  let missedImportant = 0;
  for (const item of items) {
    if (isAcknowledged(item.status)) acknowledged += 1;
    if (item.state === "missed") {
      missed += 1;
      if (item.priority === "IMPORTANT") missedImportant += 1;
    }
  }
  return { total: items.length, acknowledged, missed, missedImportant };
}

export type AcknowledgeAction = "DONE" | "SKIP" | "LATER";

/** How long "remind me later" pushes an occurrence out. */
const SNOOZE_MS = 60 * 60 * 1000;

/**
 * Record the elder's answer to one occurrence. Verifies the reminder
 * belongs to the user and that the instant is a genuine occurrence, then
 * upserts the log idempotently.
 */
export async function acknowledgeOccurrence(
  userId: string,
  reminderId: string,
  scheduledFor: Date,
  action: AcknowledgeAction,
  timeZone: string,
  now: Date = new Date(),
): Promise<"ok" | "not_found" | "invalid_occurrence"> {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, userId },
  });
  if (!reminder) return "not_found";

  // Integrity: the instant must actually be an occurrence of this
  // reminder on its own local day (a ±1 day window covers boundaries).
  const localDay = localDayOf(scheduledFor, timeZone);
  const windowStart = zonedTimeToUtc(addDays(localDay, -1), 0, timeZone);
  const windowEnd = zonedTimeToUtc(addDays(localDay, 2), 0, timeZone);
  const valid = occurrencesBetween(
    toSchedule(reminder),
    windowStart,
    windowEnd,
    timeZone,
  ).some((o) => o.getTime() === scheduledFor.getTime());
  if (!valid) return "invalid_occurrence";

  const status: ReminderLogStatus =
    action === "DONE" ? "DONE" : action === "SKIP" ? "SKIPPED" : "SNOOZED";
  const acknowledgedAt = action === "LATER" ? null : now;
  const snoozedUntil =
    action === "LATER" ? new Date(now.getTime() + SNOOZE_MS) : null;

  await prisma.reminderLog.upsert({
    where: {
      reminderId_scheduledFor: { reminderId, scheduledFor },
    },
    create: {
      reminderId,
      userId,
      scheduledFor,
      status,
      acknowledgedAt,
      snoozedUntil,
    },
    update: { status, acknowledgedAt, snoozedUntil },
  });

  return "ok";
}
