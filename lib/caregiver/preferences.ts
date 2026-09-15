import "server-only";

import type { CaregiverPreference, Language } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * Caregiver preferences: the language they read the dashboard in, and
 * what they want to be told about.
 */

export const CAREGIVER_PREF_DEFAULTS = {
  language: "EN" as Language,
  reminderNotifications: true,
  cognitiveActivityReminders: true,
  alertNotifications: true,
  weeklySummary: true,
};

/**
 * The language to render the caregiver dashboard in.
 *
 * Reads the CAREGIVER's own preference and nothing else. It never
 * consults the linked elder's `UserPreference`, which is the whole
 * point: the two people may read different languages, and a caregiver
 * must never be able to change what the elderly person sees on their
 * own device by adjusting their own dashboard.
 *
 * A read-only lookup, so it does not lazily create the row the way
 * `getCaregiverPreference` does — rendering a page should not write.
 */
export async function caregiverLanguage(
  caregiverId: string,
): Promise<Language> {
  const preference = await prisma.caregiverPreference.findUnique({
    where: { caregiverId },
    select: { language: true },
  });
  return preference?.language ?? CAREGIVER_PREF_DEFAULTS.language;
}

/** Read (and lazily create) a caregiver's preferences. */
export async function getCaregiverPreference(
  caregiverId: string,
): Promise<CaregiverPreference> {
  return prisma.caregiverPreference.upsert({
    where: { caregiverId },
    create: { caregiverId, ...CAREGIVER_PREF_DEFAULTS },
    update: {},
  });
}

export async function updateCaregiverPreference(
  caregiverId: string,
  input: Partial<typeof CAREGIVER_PREF_DEFAULTS>,
): Promise<CaregiverPreference> {
  return prisma.caregiverPreference.upsert({
    where: { caregiverId },
    create: { caregiverId, ...CAREGIVER_PREF_DEFAULTS, ...input },
    update: { ...input },
  });
}
