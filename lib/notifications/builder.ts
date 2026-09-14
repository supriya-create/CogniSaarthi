import type { ReminderCategory } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import {
  reminderCategoryLabel,
  REMINDER_CATEGORY_EMOJI,
} from "@/lib/reminders/labels";
import type { NotificationPayload } from "@/lib/notifications/types";

/**
 * NOTIFICATION BUILDER
 * -----------------------------------------------------------------
 * Turns a reminder into the text shown or spoken to the elder. Copy is
 * calm and localised, and for MEDICATION it never says "take" — it
 * announces the reminder, nothing more.
 */

/** The in-app card text for an elder reminder. */
export function buildElderReminderPayload(
  dict: Dict,
  category: ReminderCategory,
  title: string,
): NotificationPayload {
  return {
    title: `${REMINDER_CATEGORY_EMOJI[category]} ${title}`,
    body: reminderCategoryLabel(dict, category),
  };
}

/**
 * What the voice assistant says when reading a reminder aloud. Gentle
 * and non-instructive: "It's time for: Morning medicine."
 */
export function buildSpokenReminder(dict: Dict, title: string): string {
  return `${dict.reminderItsTime} ${title}`;
}
