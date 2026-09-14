import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Caregiver → elder authorization, shared by every Phase 4 caregiver
 * feature (reminders, notes, alerts, emergency contacts). The single
 * rule: a caregiver may only ever touch resources for an elder they are
 * ACTIVELY linked to. Checked on every read and write, never assumed.
 */

/** True when this caregiver has an active link to this elder. */
export async function caregiverLinkedTo(
  caregiverId: string,
  userId: string,
): Promise<boolean> {
  const link = await prisma.caregiverLink.findFirst({
    where: { caregiverId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  return link !== null;
}

/** The elder a caregiver manages (their oldest active link), or null. */
export async function linkedUserFor(caregiverId: string) {
  const link = await prisma.caregiverLink.findFirst({
    where: { caregiverId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { preference: true } } },
  });
  return link?.user ?? null;
}

/**
 * The elder's configured timezone, defaulting to the app's home region.
 * Every reminder computation must go through this rather than assuming
 * UTC or the server timezone.
 */
export async function timeZoneForUser(userId: string): Promise<string> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return pref?.timeZone ?? "Asia/Kolkata";
}
