import "server-only";

import type { Reminder } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/caregiver/access";
import type { ReminderSchedule } from "@/lib/reminders/recurrence";

/**
 * Reminder data access, with authorization built in. A caregiver may
 * only read or change reminders for an elder they are actively linked
 * to; the elder only ever reads their own.
 */

/** Map a stored Reminder to the pure scheduling shape the engine uses. */
export function toSchedule(reminder: Reminder): ReminderSchedule {
  return {
    timeMinutes: reminder.timeMinutes,
    recurrence: reminder.recurrence,
    weekdays: reminder.weekdays,
    monthDay: reminder.monthDay,
    startDate: reminder.startDate,
    endDate: reminder.endDate,
  };
}

/** All reminders for an elder, earliest local time first (caregiver view). */
export async function getRemindersForUser(userId: string): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: [{ timeMinutes: "asc" }, { createdAt: "asc" }],
  });
}

/** Only enabled reminders (the ones that actually fire). */
export async function getEnabledRemindersForUser(
  userId: string,
): Promise<Reminder[]> {
  return prisma.reminder.findMany({
    where: { userId, enabled: true },
    orderBy: [{ timeMinutes: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Fetch a reminder only if this caregiver may act on it. Returns null
 * when it does not exist OR the caregiver is not linked to its owner —
 * indistinguishable to the caller, by design.
 */
export async function getReminderForCaregiver(
  reminderId: string,
  caregiverId: string,
): Promise<Reminder | null> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!reminder) return null;
  if (!(await caregiverLinkedTo(caregiverId, reminder.userId))) return null;
  return reminder;
}
