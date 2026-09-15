import "server-only";

import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/privacy/audit";
import { getConsentStatus } from "@/lib/privacy/server";

/**
 * PRIVACY — a person's own copy of their data.
 * -----------------------------------------------------------------
 * Not to be confused with `lib/research-data/export-service.ts`. That
 * one produces a minimised, pseudonymous representation FOR RESEARCH
 * and excludes almost everything. This one produces a complete, plainly
 * readable copy FOR THE PERSON THEMSELVES, and therefore includes the
 * personal things the research export would never touch.
 *
 * The two must never be confused for one another, which is why they
 * live in different folders with different names and return different
 * types.
 *
 * What is still excluded even here:
 *  - password hashes and session tokens (a copy of a credential is a
 *    credential; nobody needs their own hash);
 *  - image BYTES. The export names the memories that have a photo and
 *    says so, rather than inlining megabytes of family photographs into
 *    a JSON blob that might then be emailed around.
 */

export interface PersonalDataExport {
  generatedAt: string;
  profile: {
    id: string;
    name: string;
    language: string;
    avatarId: string;
    connectCode: string;
    createdAt: string;
  };
  preferences: Record<string, unknown> | null;
  researchConsent: {
    state: string;
    version: string | null;
    updatedAt: string | null;
  };
  activities: {
    gameId: string;
    difficulty: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    score: number | null;
    accuracy: number | null;
  }[];
  reminders: {
    title: string;
    category: string;
    timeMinutes: number;
    recurrence: string;
    enabled: boolean;
  }[];
  memories: {
    category: string;
    title: string;
    relationship: string | null;
    description: string | null;
    /** Whether a photo exists. The bytes are not inlined. */
    hasPhoto: boolean;
  }[];
  caregiverNotes: { date: string; category: string; body: string }[];
  caregivers: { name: string; relationship: string; status: string }[];
  emergencyContacts: { name: string; phone: string; relationship: string }[];
}

/**
 * Build one person's full data export.
 *
 * `userId` must come from an authenticated ELDER session — this returns
 * everything about them, so there is no version of this function that
 * accepts a caller-supplied id from a request body.
 */
export async function buildPersonalDataExport(
  userId: string,
): Promise<PersonalDataExport | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preference: true,
      memories: { orderBy: { createdAt: "asc" } },
      reminders: { orderBy: { timeMinutes: "asc" } },
      notes: { orderBy: { date: "desc" } },
      emergencyContacts: true,
      caregiverLinks: { include: { caregiver: true } },
      sessions: { include: { result: true }, orderBy: { startedAt: "asc" } },
    },
  });

  if (!user) return null;

  const consent = await getConsentStatus(userId);

  const iso = (date: Date | null) => (date ? date.toISOString() : null);

  const exported: PersonalDataExport = {
    generatedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      language: user.language,
      avatarId: user.avatarId,
      connectCode: user.connectCode,
      createdAt: user.createdAt.toISOString(),
    },
    preferences: user.preference
      ? {
          language: user.preference.language,
          fontScale: user.preference.fontScale,
          highContrast: user.preference.highContrast,
          reduceMotion: user.preference.reduceMotion,
          soundEnabled: user.preference.soundEnabled,
          preferredDifficulty: user.preference.preferredDifficulty,
          voiceEnabled: user.preference.voiceEnabled,
          speechRate: user.preference.speechRate,
          timeZone: user.preference.timeZone,
        }
      : null,
    researchConsent: {
      state: consent.state,
      version: consent.version,
      updatedAt: iso(consent.updatedAt),
    },
    activities: user.sessions.map((session) => ({
      gameId: session.gameId,
      difficulty: session.difficulty,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: iso(session.completedAt),
      durationMs: session.durationMs,
      score: session.result?.score ?? null,
      accuracy: session.result?.accuracy ?? null,
    })),
    reminders: user.reminders.map((reminder) => ({
      title: reminder.title,
      category: reminder.category,
      timeMinutes: reminder.timeMinutes,
      recurrence: reminder.recurrence,
      enabled: reminder.enabled,
    })),
    memories: user.memories.map((memory) => ({
      category: memory.category,
      title: memory.title,
      relationship: memory.relationship,
      description: memory.description,
      hasPhoto: memory.imagePath !== null,
    })),
    caregiverNotes: user.notes.map((note) => ({
      date: note.date.toISOString(),
      category: note.category,
      body: note.body,
    })),
    // The caregiver's NAME and relationship, because the elder is
    // entitled to know who can see their activity. Not their email, and
    // certainly not their password hash.
    caregivers: user.caregiverLinks.map((link) => ({
      name: link.caregiver.name,
      relationship: link.relationship,
      status: link.status,
    })),
    emergencyContacts: user.emergencyContacts.map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
    })),
  };

  await recordAudit({
    action: "ACCOUNT_DATA_EXPORTED",
    userId,
    // `memoryCount`, not `memories` — see the note in export-service.ts.
    detail: {
      activityCount: exported.activities.length,
      memoryCount: exported.memories.length,
      reminderCount: exported.reminders.length,
    },
  });

  return exported;
}
