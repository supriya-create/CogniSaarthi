import type { Difficulty, Language, ReminderLogStatus } from "@prisma/client";

import { summarise } from "@/lib/game-engine/scoring";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import { newId, occurrenceKey, toIso } from "@/lib/offline/serialization";
import { syncNow } from "@/lib/offline/sync";
import type {
  LocalGameSession,
  LocalMemoryRecall,
  LocalReminderLog,
  LocalRound,
} from "@/lib/offline/types";

/**
 * OFFLINE — the actions the interface actually performs.
 * -----------------------------------------------------------------
 * Local first, always: the record is written to this device and the
 * person is told "saved" immediately. Reaching the server is a
 * background concern, attempted opportunistically and retried later if
 * it fails. Nobody waits on the network to finish an activity.
 *
 * The score computed here is for IMMEDIATE display only. It uses the
 * same `summarise()` every server write goes through, and the server
 * recomputes it on sync — the server's value is authoritative.
 */

export type AcknowledgeAction = "DONE" | "SKIP" | "LATER";

const SNOOZE_MS = 60 * 60 * 1000;

/**
 * Save a finished activity on this device and queue it for the server.
 * Returns the local record so the result screen can render at once.
 */
export async function recordGamePlayed(input: {
  userId: string;
  gameId: string;
  difficulty: Difficulty;
  language: Language;
  rounds: LocalRound[];
  durationMs: number;
  startedAt: Date;
  /** Reuse an id when retrying, so nothing is ever double-counted. */
  clientSessionId?: string;
}): Promise<LocalGameSession> {
  const now = new Date();
  const summary = summarise({
    rounds: input.rounds,
    durationMs: input.durationMs,
  });

  const session: LocalGameSession = {
    clientSessionId: input.clientSessionId ?? newId(),
    userId: input.userId,
    gameId: input.gameId,
    difficulty: input.difficulty,
    language: input.language,
    startedAt: toIso(input.startedAt) ?? now.toISOString(),
    completedAt: now.toISOString(),
    durationMs: input.durationMs,
    rounds: input.rounds,
    score: summary.score,
    accuracy: summary.accuracy,
    stars: summary.stars,
    status: "COMPLETED",
    syncStatus: "PENDING",
    createdAt: now.toISOString(),
    serverSessionId: null,
  };

  await repo.saveLocalSession(session);

  await queue.enqueue({
    entityType: "GAME_SESSION",
    entityId: session.clientSessionId,
    operation: "CREATE",
    payload: {
      clientSessionId: session.clientSessionId,
      gameId: session.gameId,
      difficulty: session.difficulty,
      language: session.language,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      durationMs: session.durationMs,
      rounds: session.rounds,
    },
  });

  // Fire and forget — the person has already been told it is saved.
  void syncNow({ pull: false });

  return session;
}

/**
 * Remove every trace of this person from the device on sign-out.
 *
 * Cognisaarthi is built for a SHARED family tablet, so "signed out"
 * has to mean the next person cannot see the last person's activities —
 * neither the local replica nor any page the service worker cached.
 */
export async function wipeLocalDataOnSignOut(): Promise<void> {
  await repo.clearLocalData();

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: "CLEAR_CACHES" });
    } catch {
      // No worker registered — nothing cached to clear.
    }
  }
}

/**
 * Record one answer to a personal-recall prompt.
 *
 * Local first, like everything else here: the event is written to this
 * device and queued, and the activity carries on without waiting. The
 * person is never shown a spinner, an error, or any indication that
 * this was recorded at all — it is not a test and must not feel like
 * one.
 *
 * The `clientEventId` is generated here and is what makes a replayed
 * push harmless. Without it a patchy connection would inflate the
 * record of how often somebody was asked, which is precisely the
 * signal Memory Lane will later depend on.
 */
export async function recordMemoryRecallLocally(input: {
  memoryId: string;
  outcome: LocalMemoryRecall["outcome"];
  mode: LocalMemoryRecall["mode"];
  responseTimeMs: number | null;
}): Promise<LocalMemoryRecall> {
  const now = new Date();

  const event: LocalMemoryRecall = {
    clientEventId: newId(),
    memoryId: input.memoryId,
    outcome: input.outcome,
    mode: input.mode,
    responseTimeMs: input.responseTimeMs,
    occurredAt: now.toISOString(),
    syncStatus: "PENDING",
  };

  await repo.saveMemoryRecall(event);

  await queue.enqueue({
    entityType: "MEMORY_RECALL",
    entityId: event.clientEventId,
    operation: "CREATE",
    payload: {
      clientEventId: event.clientEventId,
      memoryId: event.memoryId,
      outcome: event.outcome,
      mode: event.mode,
      responseTimeMs: event.responseTimeMs,
      occurredAt: event.occurredAt,
    },
  });

  void syncNow({ pull: false });

  return event;
}

function statusFor(action: AcknowledgeAction): ReminderLogStatus {
  if (action === "DONE") return "DONE";
  if (action === "SKIP") return "SKIPPED";
  return "SNOOZED";
}

/**
 * Answer one reminder occurrence on this device. Works identically
 * online and offline; the difference is only how soon the server hears
 * about it.
 */
export async function acknowledgeReminderLocally(input: {
  reminderId: string;
  scheduledFor: string;
  action: AcknowledgeAction;
}): Promise<LocalReminderLog> {
  const now = new Date();
  const status = statusFor(input.action);

  const log: LocalReminderLog = {
    key: occurrenceKey(input.reminderId, input.scheduledFor),
    reminderId: input.reminderId,
    scheduledFor: input.scheduledFor,
    status,
    acknowledgedAt: input.action === "LATER" ? null : now.toISOString(),
    snoozedUntil:
      input.action === "LATER"
        ? new Date(now.getTime() + SNOOZE_MS).toISOString()
        : null,
    syncStatus: "PENDING",
    fromServer: false,
  };

  await repo.saveReminderLog(log);

  await queue.enqueue({
    entityType: "REMINDER_LOG",
    entityId: log.key,
    operation: "ACKNOWLEDGE",
    payload: {
      reminderId: log.reminderId,
      scheduledFor: log.scheduledFor,
      action: input.action,
      // The moment the person actually answered, so the server can
      // resolve conflicts by event time rather than arrival time.
      eventAt: now.toISOString(),
    },
  });

  void syncNow({ pull: false });

  return log;
}
