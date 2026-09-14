import "server-only";

import type { Reminder } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/caregiver/access";
import { getReminderForCaregiver } from "@/lib/reminders/queries";
import { parseTimeMinutes } from "@/lib/reminders/recurrence";
import { zonedTimeToUtc } from "@/lib/reminders/timezone";
import type { ReminderInput } from "@/lib/validation/schemas";

/**
 * Reminder create/update/delete, with authorization built in. A
 * caregiver may only write reminders for an elder they are actively
 * linked to. The wall-clock `time` and local `startDate` are converted
 * to storage against the elder's own timezone here — never assumed UTC.
 */

/** Local midnight (as a UTC instant) of a YYYY-MM-DD in the elder's zone. */
function localMidnight(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day }, 0, timeZone);
}

/** The Prisma data common to create and update. */
function toData(input: ReminderInput, timeZone: string) {
  const timeMinutes = parseTimeMinutes(input.time) ?? 0;
  return {
    title: input.title,
    description: input.description ? input.description : null,
    category: input.category,
    priority: input.priority ?? "NORMAL",
    timeMinutes,
    recurrence: input.recurrence,
    weekdays: input.recurrence === "WEEKLY" ? (input.weekdays ?? []) : [],
    monthDay: input.recurrence === "MONTHLY" ? (input.monthDay ?? null) : null,
    startDate: localMidnight(input.startDate, timeZone),
    endDate: input.endDate ? localMidnight(input.endDate, timeZone) : null,
    enabled: input.enabled ?? true,
  };
}

export async function createReminder(
  caregiverId: string,
  userId: string,
  timeZone: string,
  input: ReminderInput,
): Promise<Reminder | null> {
  if (!(await caregiverLinkedTo(caregiverId, userId))) return null;
  return prisma.reminder.create({
    data: { userId, caregiverId, ...toData(input, timeZone) },
  });
}

export async function updateReminder(
  caregiverId: string,
  reminderId: string,
  timeZone: string,
  input: ReminderInput,
): Promise<"ok" | "not_found"> {
  const existing = await getReminderForCaregiver(reminderId, caregiverId);
  if (!existing) return "not_found";
  await prisma.reminder.update({
    where: { id: reminderId },
    data: toData(input, timeZone),
  });
  return "ok";
}

/** Toggle enabled without resending the whole definition. */
export async function setReminderEnabled(
  caregiverId: string,
  reminderId: string,
  enabled: boolean,
): Promise<"ok" | "not_found"> {
  const existing = await getReminderForCaregiver(reminderId, caregiverId);
  if (!existing) return "not_found";
  await prisma.reminder.update({ where: { id: reminderId }, data: { enabled } });
  return "ok";
}

export async function deleteReminder(
  caregiverId: string,
  reminderId: string,
): Promise<"ok" | "not_found"> {
  const existing = await getReminderForCaregiver(reminderId, caregiverId);
  if (!existing) return "not_found";
  await prisma.reminder.delete({ where: { id: reminderId } });
  return "ok";
}
