import type { AlertSeverity, Difficulty, ReminderCategory, ReminderLogStatus } from "@prisma/client";

/**
 * CAREGIVER OFFLINE — the snapshot shape and its freshness rules.
 * -----------------------------------------------------------------
 * Pure: no Prisma client, no IndexedDB, no server-only import, so every
 * rule below is unit-testable and can be used on both sides.
 *
 * ## This is not the elder's offline mode
 *
 * The elder experience is offline-FIRST: activities are played, saved
 * and queued without a network, and the local database is a working
 * store. The caregiver experience is deliberately narrower — a
 * READ-ONLY photograph of a moment. A caregiver looking at a stale
 * dashboard and believing it is live is worse than a caregiver who
 * cannot see a dashboard at all, so the staleness is never implicit.
 *
 * ## What is deliberately NOT in here
 *
 *  - Memory photographs and their descriptions. The most sensitive data
 *    in the product; a caregiver's offline convenience does not justify
 *    persisting a family album to a shared tablet's disk.
 *  - Emergency contact names and phone numbers. Nothing about the
 *    caregiver dashboard needs them offline, and a phone number in
 *    IndexedDB is a phone number anyone with the device can read.
 *  - Caregiver note bodies. Free text written about a person.
 *  - Reminder TITLES. A medication reminder's title can name a
 *    medication. The caregiver's offline question is "were today's
 *    reminders answered?", which the category, the time and the status
 *    answer completely — so the title is not carried.
 *  - Any credential, token or cookie. Ever.
 */

/** Bumped when the stored shape changes incompatibly. */
export const CAREGIVER_SNAPSHOT_VERSION = 1;

/** How long a snapshot may be shown before it is called out as old. */
export const SNAPSHOT_STALE_MS = 15 * 60 * 1000; // 15 minutes
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SnapshotElder {
  /** Display name only. */
  name: string;
  avatarId: string;
  relationship: string;
}

export interface SnapshotTodaySummary {
  activitiesCompleted: number;
  activitiesGoal: number;
  remindersAcknowledged: number;
  remindersTotal: number;
  averageScore: number | null;
}

export interface SnapshotSessionRow {
  gameId: string;
  gameName: string;
  difficulty: Difficulty;
  score: number | null;
  stars: number | null;
  completedAt: string | null; // ISO
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
}

/** One reminder occurrence, by category and time — never by title. */
export interface SnapshotReminderRow {
  category: ReminderCategory;
  timeMinutes: number;
  status: ReminderLogStatus;
}

export interface SnapshotAlertRow {
  severity: AlertSeverity;
  title: string;
  body: string;
  createdAt: string; // ISO
  unread: boolean;
}

export interface SnapshotTrendRow {
  domain: string;
  label: string;
  direction: "IMPROVING" | "STEADY" | "DECLINING" | "UNKNOWN";
  /** Honest confidence from the Phase 6 layer, carried through. */
  confidence: string;
}

export interface CaregiverSnapshotData {
  elder: SnapshotElder;
  today: SnapshotTodaySummary;
  recentSessions: SnapshotSessionRow[];
  reminders: SnapshotReminderRow[];
  alerts: SnapshotAlertRow[];
  trends: SnapshotTrendRow[];
}

/**
 * The stored record.
 *
 * `elderId` is here so a snapshot can be matched to the elder it
 * describes — but it is SERVER-ASSERTED. The client never sends an
 * elder id when asking for a snapshot, and the server never reads one
 * from the request. See `lib/caregiver/snapshot.ts`.
 */
export interface CaregiverSnapshot {
  snapshotVersion: number;
  /** Which caregiver account this belongs to — the IndexedDB key. */
  caregiverId: string;
  elderId: string;
  generatedAt: string; // ISO
  expiresAt: string; // ISO
  data: CaregiverSnapshotData;
}

export type SnapshotFreshness = "FRESH" | "STALE" | "EXPIRED" | "INCOMPATIBLE";

/**
 * How much to trust what is on screen.
 *
 * INCOMPATIBLE is returned for a snapshot written by an older version
 * of the app. It is not silently upgraded and not silently shown:
 * guessing at the meaning of a shape we no longer define is how a
 * caregiver ends up reading last month's numbers as today's.
 */
export function snapshotFreshness(
  snapshot: Pick<CaregiverSnapshot, "snapshotVersion" | "generatedAt" | "expiresAt">,
  now: Date = new Date(),
): SnapshotFreshness {
  if (snapshot.snapshotVersion !== CAREGIVER_SNAPSHOT_VERSION) {
    return "INCOMPATIBLE";
  }

  const generated = new Date(snapshot.generatedAt).getTime();
  const expires = new Date(snapshot.expiresAt).getTime();
  if (Number.isNaN(generated) || Number.isNaN(expires)) return "INCOMPATIBLE";

  if (now.getTime() >= expires) return "EXPIRED";
  if (now.getTime() - generated >= SNAPSHOT_STALE_MS) return "STALE";
  return "FRESH";
}

/**
 * "20 minutes ago", in whole units.
 *
 * Kept vague on purpose at the long end ("more than a day ago"): a
 * precise age for a snapshot that old implies a precision about the
 * underlying figures that they do not have.
 */
export function describeAge(generatedAt: string, now: Date = new Date()): string {
  const generated = new Date(generatedAt).getTime();
  if (Number.isNaN(generated)) return "at an unknown time";

  const minutes = Math.floor((now.getTime() - generated) / 60000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  return "more than a day ago";
}

/**
 * The exact sentence shown above a caregiver snapshot.
 *
 * Centralised so the wording cannot drift between the banner, the empty
 * state and any future surface — and so a test can assert that offline
 * copy never says anything like "live" or "now".
 */
export function stalenessMessage(
  freshness: SnapshotFreshness,
  generatedAt: string,
  now: Date = new Date(),
): string {
  const age = describeAge(generatedAt, now);

  switch (freshness) {
    case "EXPIRED":
      return `Showing information saved earlier. Last updated ${age}. This information may be out of date.`;
    case "STALE":
    case "FRESH":
      return `Showing information saved earlier. Last updated ${age}.`;
    case "INCOMPATIBLE":
      return "Saved information could not be read. Reconnect to see the latest.";
  }
}
