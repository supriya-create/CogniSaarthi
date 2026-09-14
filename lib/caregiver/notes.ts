import "server-only";

import type { CaregiverNote, NoteCategory } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/caregiver/access";

/**
 * Caregiver notes: free-text observations about the elder, kept exactly
 * as written. Nothing here parses a note into a medical conclusion. A
 * linked caregiver may read every note for their elder; only the author
 * may edit or delete their own.
 */

export async function getNotesForUser(
  userId: string,
  take = 60,
): Promise<CaregiverNote[]> {
  return prisma.caregiverNote.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take,
  });
}

/** Notes for the caregiver list, each with its author's name. */
export async function getNotesWithAuthors(userId: string, take = 60) {
  return prisma.caregiverNote.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take,
    include: { caregiver: { select: { id: true, name: true } } },
  });
}

export async function createNote(
  caregiverId: string,
  userId: string,
  input: { body: string; category: NoteCategory; date?: Date },
): Promise<CaregiverNote | null> {
  if (!(await caregiverLinkedTo(caregiverId, userId))) return null;
  return prisma.caregiverNote.create({
    data: {
      caregiverId,
      userId,
      body: input.body,
      category: input.category,
      ...(input.date ? { date: input.date } : {}),
    },
  });
}

/** A note the caregiver may act on: they authored it. */
export async function getOwnNote(
  noteId: string,
  caregiverId: string,
): Promise<CaregiverNote | null> {
  const note = await prisma.caregiverNote.findUnique({ where: { id: noteId } });
  if (!note) return null;
  if (note.caregiverId !== caregiverId) return null;
  return note;
}

export async function updateNote(
  caregiverId: string,
  noteId: string,
  input: { body?: string; category?: NoteCategory },
): Promise<"ok" | "not_found"> {
  const note = await getOwnNote(noteId, caregiverId);
  if (!note) return "not_found";
  await prisma.caregiverNote.update({
    where: { id: noteId },
    data: {
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
    },
  });
  return "ok";
}

export async function deleteNote(
  caregiverId: string,
  noteId: string,
): Promise<"ok" | "not_found"> {
  const note = await getOwnNote(noteId, caregiverId);
  if (!note) return "not_found";
  await prisma.caregiverNote.delete({ where: { id: noteId } });
  return "ok";
}
