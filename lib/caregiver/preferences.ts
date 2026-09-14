import "server-only";

import type { CaregiverPreference } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * Caregiver notification preferences. In-app is the only delivery
 * channel in Phase 4; these toggles gate what a caregiver is shown and
 * are the seam a future channel would read.
 */

export const CAREGIVER_PREF_DEFAULTS = {
  reminderNotifications: true,
  cognitiveActivityReminders: true,
  alertNotifications: true,
  weeklySummary: true,
};

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
