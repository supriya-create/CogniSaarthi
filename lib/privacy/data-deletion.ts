import "server-only";

import { prisma } from "@/lib/db/prisma";
import { deleteMemoryAudio } from "@/lib/memories/audio";
import { deleteMemoryImage } from "@/lib/memories/storage";
import { recordAudit } from "@/lib/privacy/audit";

/**
 * PRIVACY — account deletion.
 * -----------------------------------------------------------------
 * Deliberately NOT a one-line `prisma.user.delete()`, even though the
 * schema's cascades would make that appear to work.
 *
 * ## What the schema actually does
 *
 * `onDelete: Cascade` from `User` removes: UserPreference, GameSession
 * (and GameResult through its own cascade), CaregiverLink,
 * PersonalMemory, Reminder (and ReminderLog), CaregiverNote, Alert,
 * EmergencyContact, ResearchConsent.
 *
 * ## What it does NOT do, and why this service exists
 *
 *  1. **Memory image files.** Photographs live on disk under
 *     ./storage/memory-images, not in PostgreSQL. A cascade deletes the
 *     PersonalMemory row and orphans the JPEG — among the most
 *     sensitive artefacts in the product — leaving a family photo on
 *     disk with no record that it belongs to anyone.
 *
 *     Since Memory Lane the same is true of the familiar-voice
 *     RECORDINGS under ./storage/memory-audio. `MemoryAudio` cascades
 *     away with its memory, which makes the leak completely invisible:
 *     the database looks clean and a recording of somebody's daughter
 *     saying their name is still on the disk. Both kinds are read out
 *     before the rows are deleted and unlinked afterwards.
 *
 *  2. **AuditEvent.** Has no foreign key and is not cascaded, by
 *     design. The record that a deletion happened must survive the
 *     deletion. It contains no content — only that an action occurred.
 *
 *  3. **Caregiver accounts.** Not touched. A caregiver is a separate
 *     person with their own login who may care for others; deleting an
 *     elder must not delete them. Their LINK goes, so their access does.
 *
 * ## The IndexedDB replica
 *
 * Server deletion cannot reach a device that is offline. The local
 * replica is cleared on sign-out (`wipeLocalDataOnSignOut`) and when a
 * different person signs in on the same device (`ensureUserScope`). A
 * device that never reconnects keeps its copy — a real limitation,
 * documented in docs/privacy-and-consent.md rather than glossed over.
 */

export interface DeletionPlan {
  userId: string;
  counts: {
    sessions: number;
    memories: number;
    memoryImages: number;
    memoryRecordings: number;
    /** Answers given in Memory Lane. Cascade from User. */
    recallEvents: number;
    reminders: number;
    reminderLogs: number;
    notes: number;
    alerts: number;
    emergencyContacts: number;
    caregiverLinks: number;
    researchConsents: number;
  };
  /** Things this deletion does NOT remove, stated plainly. */
  retained: string[];
}

/**
 * Work out exactly what would be removed, without removing anything.
 *
 * Deleting someone's account is irreversible, so the plan is separable
 * from the act: a caller can show it, log it, or confirm it first.
 */
export async function planAccountDeletion(
  userId: string,
): Promise<DeletionPlan | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return null;

  const [
    sessions,
    memories,
    memoryImages,
    memoryRecordings,
    recallEvents,
    reminders,
    reminderLogs,
    notes,
    alerts,
    emergencyContacts,
    caregiverLinks,
    researchConsents,
  ] = await Promise.all([
    prisma.gameSession.count({ where: { userId } }),
    prisma.personalMemory.count({ where: { userId } }),
    prisma.personalMemory.count({
      where: { userId, imagePath: { not: null } },
    }),
    prisma.memoryAudio.count({ where: { memory: { userId } } }),
    prisma.memoryRecallEvent.count({ where: { userId } }),
    prisma.reminder.count({ where: { userId } }),
    prisma.reminderLog.count({ where: { userId } }),
    prisma.caregiverNote.count({ where: { userId } }),
    prisma.alert.count({ where: { userId } }),
    prisma.emergencyContact.count({ where: { userId } }),
    prisma.caregiverLink.count({ where: { userId } }),
    prisma.researchConsent.count({ where: { userId } }),
  ]);

  return {
    userId,
    counts: {
      sessions,
      memories,
      memoryImages,
      memoryRecordings,
      recallEvents,
      reminders,
      reminderLogs,
      notes,
      alerts,
      emergencyContacts,
      caregiverLinks,
      researchConsents,
    },
    retained: [
      "Audit events recording that consent changed or data was exported or deleted (no content, no identifiers beyond an id string).",
      "Caregiver accounts themselves, which belong to other people. Their link to this person is removed, so their access ends.",
      "Any local copy on a device that is currently offline, until that device next signs out or a different person signs in on it.",
    ],
  };
}

/**
 * Delete one person's account and everything that belongs to them.
 *
 * Order matters and is not incidental:
 *
 *   1. Read every stored filename — photographs AND voice recordings —
 *      while the rows that name them still exist.
 *   2. Delete the User row — one transaction, cascades do the rest.
 *   3. Unlink the files.
 *
 * Files are removed AFTER the database commits, so a failed delete
 * cannot leave rows pointing at photographs that are already gone. The
 * opposite failure — a committed delete and a leftover file — is caught
 * because deletion of each file is attempted individually and the count
 * of failures is returned rather than swallowed.
 */
export async function deleteAccount(userId: string): Promise<{
  deleted: boolean;
  plan: DeletionPlan | null;
  imagesRemoved: number;
  imagesFailed: number;
  recordingsRemoved: number;
  recordingsFailed: number;
}> {
  const empty = {
    imagesRemoved: 0,
    imagesFailed: 0,
    recordingsRemoved: 0,
    recordingsFailed: 0,
  };

  const plan = await planAccountDeletion(userId);
  if (!plan) return { deleted: false, plan: null, ...empty };

  // Both kinds of file, read out together while the rows survive.
  const withFiles = await prisma.personalMemory.findMany({
    where: { userId },
    select: { imagePath: true, audio: { select: { path: true } } },
  });

  await prisma.user.delete({ where: { id: userId } });

  let imagesRemoved = 0;
  let imagesFailed = 0;
  let recordingsRemoved = 0;
  let recordingsFailed = 0;

  for (const memory of withFiles) {
    if (memory.imagePath) {
      try {
        await deleteMemoryImage(memory.imagePath);
        imagesRemoved += 1;
      } catch {
        imagesFailed += 1;
      }
    }
    if (memory.audio) {
      try {
        await deleteMemoryAudio(memory.audio.path);
        recordingsRemoved += 1;
      } catch {
        recordingsFailed += 1;
      }
    }
  }

  await recordAudit({
    action: "ACCOUNT_DATA_DELETED",
    userId,
    detail: {
      sessionCount: plan.counts.sessions,
      memoryCount: plan.counts.memories,
      imagesRemoved,
      imagesFailed,
      recordingsRemoved,
      recordingsFailed,
    },
  });

  return {
    deleted: true,
    plan,
    imagesRemoved,
    imagesFailed,
    recordingsRemoved,
    recordingsFailed,
  };
}
