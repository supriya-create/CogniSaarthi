import type {
  Difficulty,
  FontScale,
  Language,
  MemoryCategory,
  ReminderCategory,
  ReminderLogStatus,
  ReminderPriority,
  SpeechRate,
} from "@prisma/client";

/**
 * OFFLINE-FIRST — shared types.
 * -----------------------------------------------------------------
 * IndexedDB is a local REPLICA and an offline workspace. PostgreSQL
 * remains the authoritative store: anything created offline is pushed
 * up and re-validated (and re-scored) by the server.
 *
 * Nothing in this file imports a browser global, so the pure logic
 * around it stays unit-testable under the Node test runner.
 */

// ---------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------

/** Application-level connectivity, not merely `navigator.onLine`. */
export type ConnectionState = "ONLINE" | "OFFLINE" | "SYNCING";

// ---------------------------------------------------------------
// Cached entities
// ---------------------------------------------------------------

/** The elder's own profile and preferences, cached for offline use.
 *  Deliberately contains NO credentials, tokens or secrets. */
export interface CachedProfile {
  id: string;
  name: string;
  avatarId: string;
  language: Language;
  fontScale: FontScale;
  reduceMotion: boolean;
  voiceEnabled: boolean;
  autoReadInstructions: boolean;
  speechRate: SpeechRate;
  timeZone: string;
  reminderVoice: boolean;
  autoReadReminders: boolean;
  notificationSound: boolean;
}

/** Catalogue metadata for one activity. The playable CONTENT (object
 *  banks, stories, instructions, dictionaries) is bundled with the app
 *  itself, so it is offline by construction and is not cached here. */
export interface CachedGame {
  id: string;
  name: string;
  domain: string;
  iconKey: string;
  sortOrder: number;
  /** The level the adaptive engine chose at snapshot time. */
  recommendedDifficulty: Difficulty;
}

/** One round of telemetry, matching the server's round schema. */
export interface LocalRound {
  index: number;
  correct: number;
  total: number;
  mistakes: number;
  hintsUsed: number;
  responseTimeMs: number;
  detail?: Record<string, unknown>;
}

export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";

/**
 * A game played on this device. `clientSessionId` is generated locally
 * and is the idempotency key the server de-duplicates on, so replaying
 * a sync can never create a second session.
 *
 * `score` here is for IMMEDIATE local display only. The server
 * recomputes it from `rounds` and its value wins.
 */
export interface LocalGameSession {
  clientSessionId: string;
  userId: string;
  gameId: string;
  difficulty: Difficulty;
  language: Language;
  startedAt: string; // ISO
  completedAt: string | null; // ISO
  durationMs: number;
  rounds: LocalRound[];
  /** Locally computed, for display before the server confirms. */
  score: number;
  accuracy: number;
  stars: number;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  syncStatus: SyncStatus;
  createdAt: string; // ISO
  /** Server id once synchronised, so history can de-duplicate. */
  serverSessionId: string | null;
}

/** A reminder definition, cached so the day can be rebuilt offline. */
export interface CachedReminder {
  id: string;
  title: string;
  description: string | null;
  category: ReminderCategory;
  priority: ReminderPriority;
  timeMinutes: number;
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  weekdays: number[];
  monthDay: number | null;
  startDate: string; // ISO
  endDate: string | null; // ISO
  enabled: boolean;
}

/**
 * A local acknowledgement of one reminder occurrence. Keyed by the
 * occurrence (reminder + instant), which is exactly the server's own
 * unique key — so syncing is naturally idempotent.
 */
export interface LocalReminderLog {
  /** `${reminderId}|${scheduledFor}` */
  key: string;
  reminderId: string;
  scheduledFor: string; // ISO
  status: ReminderLogStatus;
  /** When the person actually answered, on this device. */
  acknowledgedAt: string | null; // ISO
  snoozedUntil: string | null; // ISO
  syncStatus: SyncStatus;
  /** Set when the record came down from the server rather than local. */
  fromServer: boolean;
}

/** Personal memory metadata. Images are NOT stored here; they are
 *  fetched through the existing authenticated route and cached only by
 *  the browser's own HTTP cache for the signed-in user. */
export interface CachedMemory {
  id: string;
  category: MemoryCategory;
  title: string;
  relationship: string | null;
  description: string | null;
  hasImage: boolean;
}

// ---------------------------------------------------------------
// Sync queue
// ---------------------------------------------------------------

export type SyncEntityType = "GAME_SESSION" | "REMINDER_LOG";

export type SyncOperationKind =
  | "CREATE"
  | "UPDATE"
  | "ACKNOWLEDGE"
  | "DELETE";

export type SyncOperationStatus =
  | "PENDING"
  | "IN_FLIGHT"
  | "DONE"
  | "FAILED"
  | "NEEDS_AUTH";

/**
 * One durable unit of work waiting to reach the server. Payloads are
 * plain validated data — never executable code — and are re-validated
 * server-side with Zod before anything is written.
 */
export interface SyncOperation {
  id: string;
  entityType: SyncEntityType;
  /** The client-side identity of the thing being synced. */
  entityId: string;
  operation: SyncOperationKind;
  payload: unknown;
  createdAt: string; // ISO
  attempts: number;
  lastAttemptAt: string | null; // ISO
  status: SyncOperationStatus;
  errorCode: string | null;
}

/** Per-operation outcome returned by the server. */
export interface SyncOperationResult {
  id: string;
  ok: boolean;
  /** Server-side id assigned (e.g. the real GameSession id). */
  serverId?: string;
  /** Machine-readable failure reason, e.g. "not_found". */
  errorCode?: string;
  /** True when retrying could plausibly succeed later. */
  retryable?: boolean;
}

export interface SyncPushResponse {
  results: SyncOperationResult[];
}

/** What a sync run did, for the (deliberately small) status UI. */
export interface SyncRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  needsAuth: boolean;
}

// ---------------------------------------------------------------
// Snapshot (the pull side)
// ---------------------------------------------------------------

/** A history row as the server knows it, for offline history. */
export interface SnapshotSession {
  serverSessionId: string;
  clientSessionId: string | null;
  gameId: string;
  difficulty: Difficulty;
  language: Language;
  startedAt: string; // ISO
  completedAt: string | null; // ISO
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  score: number | null;
  accuracy: number | null;
  stars: number | null;
  durationMs: number | null;
}

/** A reminder occurrence's server-side state. */
export interface SnapshotReminderLog {
  reminderId: string;
  scheduledFor: string; // ISO
  status: ReminderLogStatus;
  acknowledgedAt: string | null; // ISO
  snoozedUntil: string | null; // ISO
}

/**
 * Everything this device needs to keep working without a network.
 * Contains no credentials and nothing belonging to another user — the
 * server builds it from the authenticated session alone.
 */
export interface OfflineSnapshot {
  userId: string;
  /** Changes whenever cached server content should be replaced. */
  contentVersion: string;
  snapshotAt: string; // ISO
  profile: CachedProfile;
  games: CachedGame[];
  reminders: CachedReminder[];
  reminderLogs: SnapshotReminderLog[];
  memories: CachedMemory[];
  sessions: SnapshotSession[];
}
