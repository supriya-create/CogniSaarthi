import type { ReminderCategory } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import type { ReminderSchedule } from "@/lib/reminders/recurrence";
import { formatTimeMinutes } from "@/lib/reminders/recurrence";

/**
 * Presentation for reminders: an icon and a NEUTRAL label per category,
 * and a human recurrence description. Category copy never instructs a
 * medical action — a MEDICATION reminder reads "Medicine", never "take
 * your medicine".
 */

export const REMINDER_CATEGORY_EMOJI: Record<ReminderCategory, string> = {
  MEDICATION: "💊",
  APPOINTMENT: "🏥",
  DAILY_ROUTINE: "🌼",
  COGNITIVE_ACTIVITY: "🧠",
  FAMILY: "👪",
  OTHER: "🔔",
};

/** Elder-facing (localised) category label. */
export function reminderCategoryLabel(
  dict: Dict,
  category: ReminderCategory,
): string {
  const map: Record<ReminderCategory, string> = {
    MEDICATION: dict.reminderCatMedication,
    APPOINTMENT: dict.reminderCatAppointment,
    DAILY_ROUTINE: dict.reminderCatDailyRoutine,
    COGNITIVE_ACTIVITY: dict.reminderCatCognitive,
    FAMILY: dict.reminderCatFamily,
    OTHER: dict.reminderCatOther,
  };
  return map[category];
}

/** Caregiver-facing (English) category label. */
export function reminderCategoryLabelEnglish(category: ReminderCategory): string {
  return {
    MEDICATION: "Medication",
    APPOINTMENT: "Appointment",
    DAILY_ROUTINE: "Daily routine",
    COGNITIVE_ACTIVITY: "Cognitive activity",
    FAMILY: "Family",
    OTHER: "Other",
  }[category];
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A plain English recurrence description for the caregiver view. */
export function describeRecurrenceEnglish(schedule: ReminderSchedule): string {
  switch (schedule.recurrence) {
    case "ONCE":
      return "Once";
    case "DAILY":
      return "Every day";
    case "WEEKLY": {
      const days = [...schedule.weekdays].sort((a, b) => a - b);
      if (days.length === 7) return "Every day";
      if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) {
        return "Mon–Fri";
      }
      if (days.length === 2 && days.includes(0) && days.includes(6)) {
        return "Weekends";
      }
      if (days.length === 0) return "Weekly";
      return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    }
    case "MONTHLY":
      return schedule.monthDay ? `Monthly (day ${schedule.monthDay})` : "Monthly";
    default:
      return "";
  }
}

/** "08:00 · Every day" style one-liner for a caregiver row. */
export function reminderScheduleSummary(
  schedule: ReminderSchedule & { timeMinutes: number },
): string {
  return `${formatTimeMinutes(schedule.timeMinutes)} · ${describeRecurrenceEnglish(schedule)}`;
}
