import type { NotificationChannel } from "@/lib/notifications/types";

/**
 * PREFERENCE CHECKING
 * -----------------------------------------------------------------
 * Pure gates that decide whether a given notification should surface,
 * given the recipient's preferences. Separated so the reminder/alert
 * code never inlines "should we show this?" logic.
 */

export interface CaregiverNotificationPrefs {
  reminderNotifications: boolean;
  cognitiveActivityReminders: boolean;
  alertNotifications: boolean;
  weeklySummary: boolean;
}

export interface ElderNotificationPrefs {
  voiceEnabled: boolean;
  reminderVoice: boolean;
  autoReadReminders: boolean;
  notificationSound: boolean;
}

/** Whether the caregiver wants to be shown alerts at all. */
export function caregiverWantsAlerts(prefs: CaregiverNotificationPrefs): boolean {
  return prefs.alertNotifications;
}

/** Whether the caregiver wants the weekly summary. */
export function caregiverWantsWeeklySummary(
  prefs: CaregiverNotificationPrefs,
): boolean {
  return prefs.weeklySummary;
}

/** Whether a reminder may be spoken aloud to the elder. */
export function elderShouldSpeakReminder(prefs: ElderNotificationPrefs): boolean {
  return prefs.voiceEnabled && prefs.reminderVoice;
}

/** Whether a reminder is read aloud automatically (without a tap). */
export function elderShouldAutoReadReminder(
  prefs: ElderNotificationPrefs,
): boolean {
  return (
    prefs.voiceEnabled && prefs.reminderVoice && prefs.autoReadReminders
  );
}

/**
 * The channels a notification should go out on. In Phase 4 this is only
 * ever IN_APP (gated by the relevant preference); the shape leaves room
 * for a later phase to add channels without changing callers.
 */
export function channelsForCaregiverAlert(
  prefs: CaregiverNotificationPrefs,
): NotificationChannel[] {
  return caregiverWantsAlerts(prefs) ? ["IN_APP"] : [];
}
