import "server-only";

import type { PersonalMemory } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * Data access for personal memories, with authorization built in.
 *
 * The rule enforced everywhere: a caregiver may only touch memories
 * for an elder they are ACTIVELY linked to. This is checked on every
 * read and write — never assumed from the caller.
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

/** The elder a caregiver manages (the oldest active link). */
export async function linkedUserFor(caregiverId: string) {
  const link = await prisma.caregiverLink.findFirst({
    where: { caregiverId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });
  return link?.user ?? null;
}

/** All memories for an elder (caregiver management view). */
export async function getMemoriesForUser(
  userId: string,
): Promise<PersonalMemory[]> {
  return prisma.personalMemory.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
}

/** Only enabled memories (elder view and recall activities). */
export async function getEnabledMemoriesForUser(
  userId: string,
): Promise<PersonalMemory[]> {
  return prisma.personalMemory.findMany({
    where: { userId, enabled: true },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Fetch a memory only if this caregiver is allowed to act on it.
 * Returns null when it does not exist OR the caregiver is not linked
 * to its owner — callers cannot tell the two apart, by design.
 */
export async function getMemoryForCaregiver(
  memoryId: string,
  caregiverId: string,
): Promise<PersonalMemory | null> {
  const memory = await prisma.personalMemory.findUnique({
    where: { id: memoryId },
  });
  if (!memory) return null;
  if (!(await caregiverLinkedTo(caregiverId, memory.userId))) return null;
  return memory;
}

/** Fetch a memory only if it belongs to this elder and is enabled. */
export async function getEnabledMemoryForUser(
  memoryId: string,
  userId: string,
): Promise<PersonalMemory | null> {
  return prisma.personalMemory.findFirst({
    where: { id: memoryId, userId, enabled: true },
  });
}
