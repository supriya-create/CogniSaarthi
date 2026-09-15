import * as db from "@/lib/offline/db";
import { META_KEYS, STORES } from "@/lib/offline/schema";
import { occurrenceKey, toIso } from "@/lib/offline/serialization";
import { resolveReminderConflict } from "@/lib/offline/conflicts";
import type {
  CachedGame,
  CachedMemory,
  CachedProfile,
  CachedReminder,
  LocalGameSession,
  LocalMemoryRecall,
  LocalReminderLog,
  OfflineSnapshot,
  SnapshotSession,
} from "@/lib/offline/types";

/**
 * OFFLINE — typed repositories.
 * -----------------------------------------------------------------
 * The only place the rest of the app reads or writes local data. Each
 * function is small and named for what the product does ("save the
 * game they just played"), not for the storage mechanism.
 *
 * The golden rule when a snapshot arrives: server data replaces the
 * CACHE, but never destroys work this device has not yet pushed. A
 * pending answer or an unsynced game survives every refresh.
 */

// ---------------------------------------------------------------
// Scoping — a shared family tablet must not mix people up
// ---------------------------------------------------------------

/**
 * Ensure the local database belongs to this elder. If a different
 * person signs in, the previous person's cached data is cleared rather
 * than shown to them.
 */
export async function ensureUserScope(userId: string): Promise<void> {
  const current = await db.getMeta<string>(META_KEYS.userId);
  if (current && current !== userId) {
    await db.clearAll();
  }
  await db.setMeta(META_KEYS.userId, userId);
}

export async function localUserId(): Promise<string | null> {
  return db.getMeta<string>(META_KEYS.userId);
}

export async function snapshotAt(): Promise<Date | null> {
  const value = await db.getMeta<string>(META_KEYS.snapshotAt);
  return value ? new Date(value) : null;
}

export async function lastSyncedAt(): Promise<Date | null> {
  const value = await db.getMeta<string>(META_KEYS.lastSyncedAt);
  return value ? new Date(value) : null;
}

export async function markSynced(now: Date = new Date()): Promise<void> {
  await db.setMeta(META_KEYS.lastSyncedAt, now.toISOString());
}

/** Clear everything local. Used on sign-out. */
export async function clearLocalData(): Promise<void> {
  await db.clearAll();
}

// ---------------------------------------------------------------
// Profile / games / reminders / memories (read-only caches)
// ---------------------------------------------------------------

export async function getProfile(): Promise<CachedProfile | null> {
  const all = await db.getAll<CachedProfile>(STORES.profile);
  return all[0] ?? null;
}

export async function getGames(): Promise<CachedGame[]> {
  const games = await db.getAll<CachedGame>(STORES.games);
  return games.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getReminders(): Promise<CachedReminder[]> {
  const reminders = await db.getAll<CachedReminder>(STORES.reminders);
  return reminders.sort((a, b) => a.timeMinutes - b.timeMinutes);
}

export async function getMemories(): Promise<CachedMemory[]> {
  return db.getAll<CachedMemory>(STORES.memories);
}

// ---------------------------------------------------------------
// Game sessions
// ---------------------------------------------------------------

/** Save a game the moment it finishes, before any network attempt. */
export async function saveLocalSession(
  session: LocalGameSession,
): Promise<void> {
  await db.put(STORES.sessions, session);
}

export async function getLocalSession(
  clientSessionId: string,
): Promise<LocalGameSession | null> {
  return db.get<LocalGameSession>(STORES.sessions, clientSessionId);
}

export async function allLocalSessions(): Promise<LocalGameSession[]> {
  const sessions = await db.getAll<LocalGameSession>(STORES.sessions);
  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingSessions(): Promise<LocalGameSession[]> {
  const sessions = await db.getAll<LocalGameSession>(STORES.sessions);
  return sessions.filter((s) => s.syncStatus === "PENDING");
}

/** Record that the server accepted this session (and its real id). */
export async function markSessionSynced(
  clientSessionId: string,
  serverSessionId: string | null,
): Promise<void> {
  const session = await getLocalSession(clientSessionId);
  if (!session) return;
  await db.put(STORES.sessions, {
    ...session,
    syncStatus: "SYNCED",
    serverSessionId: serverSessionId ?? session.serverSessionId,
  } satisfies LocalGameSession);
}

export async function markSessionFailed(
  clientSessionId: string,
): Promise<void> {
  const session = await getLocalSession(clientSessionId);
  if (!session) return;
  await db.put(STORES.sessions, {
    ...session,
    syncStatus: "FAILED",
  } satisfies LocalGameSession);
}

// ---------------------------------------------------------------
// Reminder occurrences
// ---------------------------------------------------------------

export async function getReminderLog(
  reminderId: string,
  scheduledFor: Date | string,
): Promise<LocalReminderLog | null> {
  return db.get<LocalReminderLog>(
    STORES.reminderLogs,
    occurrenceKey(reminderId, scheduledFor),
  );
}

export async function allReminderLogs(): Promise<LocalReminderLog[]> {
  return db.getAll<LocalReminderLog>(STORES.reminderLogs);
}

export async function pendingReminderLogs(): Promise<LocalReminderLog[]> {
  const logs = await db.getAll<LocalReminderLog>(STORES.reminderLogs);
  return logs.filter((l) => l.syncStatus === "PENDING");
}

export async function saveReminderLog(log: LocalReminderLog): Promise<void> {
  await db.put(STORES.reminderLogs, log);
}

export async function markReminderLogSynced(key: string): Promise<void> {
  const log = await db.get<LocalReminderLog>(STORES.reminderLogs, key);
  if (!log) return;
  await db.put(STORES.reminderLogs, {
    ...log,
    syncStatus: "SYNCED",
  } satisfies LocalReminderLog);
}

// ---------------------------------------------------------------
// Personal memory recall
// ---------------------------------------------------------------

/**
 * Save one recall answer the moment it is given.
 *
 * There is no "update" counterpart: a recall event is a fact about a
 * moment that has passed, so it is written once and only its
 * syncStatus ever changes.
 */
export async function saveMemoryRecall(
  event: LocalMemoryRecall,
): Promise<void> {
  await db.put(STORES.memoryRecalls, event);
}

export async function allMemoryRecalls(): Promise<LocalMemoryRecall[]> {
  return db.getAll<LocalMemoryRecall>(STORES.memoryRecalls);
}

export async function pendingMemoryRecalls(): Promise<LocalMemoryRecall[]> {
  const events = await db.getAll<LocalMemoryRecall>(STORES.memoryRecalls);
  return events.filter((e) => e.syncStatus === "PENDING");
}

export async function markMemoryRecallSynced(
  clientEventId: string,
): Promise<void> {
  const event = await db.get<LocalMemoryRecall>(
    STORES.memoryRecalls,
    clientEventId,
  );
  if (!event) return;
  await db.put(STORES.memoryRecalls, {
    ...event,
    syncStatus: "SYNCED",
  } satisfies LocalMemoryRecall);
}

export async function markMemoryRecallFailed(
  clientEventId: string,
): Promise<void> {
  const event = await db.get<LocalMemoryRecall>(
    STORES.memoryRecalls,
    clientEventId,
  );
  if (!event) return;
  await db.put(STORES.memoryRecalls, {
    ...event,
    syncStatus: "FAILED",
  } satisfies LocalMemoryRecall);
}

// ---------------------------------------------------------------
// Applying a snapshot
// ---------------------------------------------------------------

/**
 * Replace the cached server data with a fresh snapshot.
 *
 * Caches (profile, games, reminders, memories) are replaced wholesale
 * in one transaction each, so a failed refresh never leaves half-new
 * data. Reminder answers and game sessions are MERGED instead:
 *
 *  - a local answer still waiting to sync is kept and re-queued,
 *    unless the server's state wins under the conflict rules;
 *  - a local game session that has not synced is never overwritten.
 */
export async function applySnapshot(snapshot: OfflineSnapshot): Promise<void> {
  await ensureUserScope(snapshot.userId);

  await db.replaceAll(STORES.profile, [snapshot.profile]);
  await db.replaceAll(STORES.games, snapshot.games);
  await db.replaceAll(STORES.reminders, snapshot.reminders);
  await db.replaceAll(STORES.memories, snapshot.memories);

  await mergeReminderLogs(snapshot);
  await mergeSessions(snapshot.sessions);

  await db.setMeta(META_KEYS.contentVersion, snapshot.contentVersion);
  await db.setMeta(META_KEYS.snapshotAt, snapshot.snapshotAt);
}

async function mergeReminderLogs(snapshot: OfflineSnapshot): Promise<void> {
  const existing = await allReminderLogs();
  const byKey = new Map(existing.map((l) => [l.key, l]));

  for (const remote of snapshot.reminderLogs) {
    const key = occurrenceKey(remote.reminderId, remote.scheduledFor);
    const local = byKey.get(key);

    // Nothing local, or the local copy already came from the server:
    // take the server's word for it.
    if (!local || local.syncStatus !== "PENDING") {
      await db.put(STORES.reminderLogs, {
        key,
        reminderId: remote.reminderId,
        scheduledFor: remote.scheduledFor,
        status: remote.status,
        acknowledgedAt: remote.acknowledgedAt,
        snoozedUntil: remote.snoozedUntil,
        syncStatus: "SYNCED",
        fromServer: true,
      } satisfies LocalReminderLog);
      byKey.delete(key);
      continue;
    }

    // Both sides have something and ours has not been pushed yet.
    const resolution = resolveReminderConflict(
      { status: local.status, at: local.acknowledgedAt ? new Date(local.acknowledgedAt) : null },
      { status: remote.status, at: remote.acknowledgedAt ? new Date(remote.acknowledgedAt) : null },
    );

    if (resolution.winner === "server") {
      await db.put(STORES.reminderLogs, {
        key,
        reminderId: remote.reminderId,
        scheduledFor: remote.scheduledFor,
        status: remote.status,
        acknowledgedAt: remote.acknowledgedAt,
        snoozedUntil: remote.snoozedUntil,
        syncStatus: "SYNCED",
        fromServer: true,
      } satisfies LocalReminderLog);
    }
    // Local wins → leave it PENDING so the queue still pushes it.
    byKey.delete(key);
  }
}

/**
 * Fold server history into the local store. A session the server knows
 * about is marked SYNCED locally; anything local the server has not
 * seen is left alone so it still syncs.
 */
async function mergeSessions(remote: SnapshotSession[]): Promise<void> {
  const local = await allLocalSessions();
  const byClientId = new Map(local.map((s) => [s.clientSessionId, s]));

  for (const row of remote) {
    const existing = row.clientSessionId
      ? byClientId.get(row.clientSessionId)
      : undefined;

    if (existing) {
      // The server has it — adopt its authoritative score.
      await db.put(STORES.sessions, {
        ...existing,
        serverSessionId: row.serverSessionId,
        score: row.score ?? existing.score,
        accuracy: row.accuracy ?? existing.accuracy,
        stars: row.stars ?? existing.stars,
        status: row.status,
        syncStatus: "SYNCED",
      } satisfies LocalGameSession);
      continue;
    }

    // History that happened on another device: cache it read-only so
    // the history screen is complete offline.
    const clientSessionId = row.clientSessionId ?? `server-${row.serverSessionId}`;
    if (byClientId.has(clientSessionId)) continue;

    await db.put(STORES.sessions, {
      clientSessionId,
      userId: "",
      gameId: row.gameId,
      difficulty: row.difficulty,
      language: row.language,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs: row.durationMs ?? 0,
      rounds: [],
      score: row.score ?? 0,
      accuracy: row.accuracy ?? 0,
      stars: row.stars ?? 0,
      status: row.status,
      syncStatus: "SYNCED",
      createdAt: toIso(row.startedAt) ?? new Date().toISOString(),
      serverSessionId: row.serverSessionId,
    } satisfies LocalGameSession);
  }
}
