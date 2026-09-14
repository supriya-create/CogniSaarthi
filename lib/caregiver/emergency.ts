import "server-only";

import type { EmergencyContact } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/caregiver/access";

/**
 * Emergency contacts. A contact card only — the elder can dial it with
 * one tap, but Cognisaarthi never claims to have contacted anyone or
 * dispatched help (see the SOS notes in the README/spec).
 */

export async function getEmergencyContactsForUser(
  userId: string,
): Promise<EmergencyContact[]> {
  return prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createEmergencyContact(
  caregiverId: string,
  userId: string,
  input: { name: string; phone: string; relationship: string },
): Promise<EmergencyContact | null> {
  if (!(await caregiverLinkedTo(caregiverId, userId))) return null;
  return prisma.emergencyContact.create({
    data: {
      userId,
      name: input.name,
      phone: input.phone,
      relationship: input.relationship,
    },
  });
}

/** A contact the caregiver may act on: linked to its owner. */
export async function getContactForCaregiver(
  contactId: string,
  caregiverId: string,
): Promise<EmergencyContact | null> {
  const contact = await prisma.emergencyContact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return null;
  if (!(await caregiverLinkedTo(caregiverId, contact.userId))) return null;
  return contact;
}

export async function updateEmergencyContact(
  caregiverId: string,
  contactId: string,
  input: { name?: string; phone?: string; relationship?: string },
): Promise<"ok" | "not_found"> {
  const contact = await getContactForCaregiver(contactId, caregiverId);
  if (!contact) return "not_found";
  await prisma.emergencyContact.update({
    where: { id: contactId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.relationship !== undefined
        ? { relationship: input.relationship }
        : {}),
    },
  });
  return "ok";
}

export async function deleteEmergencyContact(
  caregiverId: string,
  contactId: string,
): Promise<"ok" | "not_found"> {
  const contact = await getContactForCaregiver(contactId, caregiverId);
  if (!contact) return "not_found";
  await prisma.emergencyContact.delete({ where: { id: contactId } });
  return "ok";
}
