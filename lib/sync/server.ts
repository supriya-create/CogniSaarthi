import "server-only";

import { Prisma, type ReminderLogStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { summarise } from "@/lib/game-engine/scoring";
import { isGameId, roundCountFor } from "@/lib/game-engine/definitions";
import { timeZoneForUser } from "@/lib/caregiver/access";
import { toSchedule } from "@/lib/reminders/queries";
import { occurrencesBetween } from "@/lib/reminders/recurrence";
import { addDays, localDayOf, zonedTimeToUtc } from "@/lib/reminders/timezone";
import { resolveReminderConflict } from "@/lib/offline/conflicts";
import type { SyncOperationResult } from "@/lib/offline/types";
import {
  gameSessionSyncPayloadSchema,
  memoryRecallSyncPayloadSchema,
  reminderAckSyncPayloadSchema,
  type SyncOperationInput,
} from "@/lib/validation/schemas";

/**
 * SERVER-SIDE SYNC
 * -----------------------------------------------------------------
 * Applies one queued operation from a device. Three rules govern
 * everything here:
 *
 *  1. IDENTITY COMES FROM THE SESSION. `userId` is passed in by the
 *     route from the authenticated cookie. A `userId` in the payload
 *     would be ignored — the schemas do not even accept one.
 *  2. IDEMPOTENT. The same operation can arrive twice (a retry, a
 *     flaky connection, two tabs). Replaying it must not create a
 *     second session or a second acknowledgement.
 *  3. THE SERVER RE-SCORES. A client-supplied score is never stored;
 *     `summarise()` recomputes it from the round data, exactly as the
 *     online path does.
 */

function ok(id: string, serverId?: string): SyncOperationResult {
  return { id, ok: true, ...(serverId ? { serverId } : {}) };
}

function fail(
  id: string,
  errorCode: string,
  retryable = false,
): SyncOperationResult {
  return { id, ok: false, errorCode, retryable };
}

export async function applySyncOperation(
  userId: string,
  operation: SyncOperationInput,
): Promise<SyncOperationResult> {
  try {
    if (operation.entityType === "GAME_SESSION") {
      return await applyGameSession(userId, operation);
    }
    if (operation.entityType === "REMINDER_LOG") {
      return await applyReminderAck(userId, operation);
    }
    if (operation.entityType === "MEMORY_RECALL") {
      return await applyMemoryRecall(userId, operation);
    }
    return fail(operation.id, "unsupported_entity");
  } catch {
    // Unexpected server-side trouble: worth retrying later.
    return fail(operation.id, "server_error", true);
  }
}

// ---------------------------------------------------------------
// Game sessions
// ---------------------------------------------------------------

async function applyGameSession(
  userId: string,
  operation: SyncOperationInput,
): Promise<SyncOperationResult> {
  const parsed = gameSessionSyncPayloadSchema.safeParse(operation.payload);
  if (!parsed.success) return fail(operation.id, "invalid_payload");

  const payload = parsed.data;
  if (!isGameId(payload.gameId)) return fail(operation.id, "unknown_game");

  // --- Idempotency: has this client session already been stored? ---
  const existing = await prisma.gameSession.findUnique({
    where: { clientSessionId: payload.clientSessionId },
    include: { result: true },
  });

  if (existing) {
    // Another person's device must never adopt or overwrite this row.
    if (existing.userId !== userId) return fail(operation.id, "conflict");
    // Already complete — replaying is a no-op, which is the point.
    if (existing.result) return ok(operation.id, existing.id);

    const summary = summarise({
      rounds: payload.rounds,
      durationMs: payload.durationMs,
    });
    await completeSession(existing.id, payload, summary);
    return ok(operation.id, existing.id);
  }

  const summary = summarise({
    rounds: payload.rounds,
    durationMs: payload.durationMs,
  });

  // Create and complete in one transaction so a session never exists
  // without the result that justified it.
  const created = await prisma.$transaction(async (tx) => {
    const session = await tx.gameSession.create({
      data: {
        userId,
        gameId: payload.gameId,
        difficulty: payload.difficulty,
        language: payload.language,
        status: "COMPLETED",
        startedAt: new Date(payload.startedAt),
        completedAt: new Date(payload.completedAt),
        durationMs: payload.durationMs,
        roundsTotal: roundCountFor(payload.gameId, payload.difficulty),
        roundsCompleted: payload.rounds.length,
        clientSessionId: payload.clientSessionId,
      },
      select: { id: true },
    });

    await tx.gameResult.create({
      data: {
        sessionId: session.id,
        score: summary.score,
        accuracy: summary.accuracy,
        stars: summary.stars,
        correctCount: summary.correctCount,
        incorrectCount: summary.incorrectCount,
        mistakes: summary.mistakes,
        hints: summary.hints,
        totalResponseTimeMs: summary.totalResponseTimeMs,
        avgResponseTimeMs: summary.avgResponseTimeMs,
        rawRounds: payload.rounds as unknown as Prisma.InputJsonValue,
      },
    });

    return session;
  });

  return ok(operation.id, created.id);
}

async function completeSession(
  sessionId: string,
  payload: { rounds: unknown[]; durationMs: number },
  summary: ReturnType<typeof summarise>,
): Promise<void> {
  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs: payload.durationMs,
        roundsCompleted: payload.rounds.length,
      },
    }),
    prisma.gameResult.create({
      data: {
        sessionId,
        score: summary.score,
        accuracy: summary.accuracy,
        stars: summary.stars,
        correctCount: summary.correctCount,
        incorrectCount: summary.incorrectCount,
        mistakes: summary.mistakes,
        hints: summary.hints,
        totalResponseTimeMs: summary.totalResponseTimeMs,
        avgResponseTimeMs: summary.avgResponseTimeMs,
        rawRounds: payload.rounds as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
}

// ---------------------------------------------------------------
// Reminder acknowledgements
// ---------------------------------------------------------------

const SNOOZE_MS = 60 * 60 * 1000;

function statusFor(action: "DONE" | "SKIP" | "LATER"): ReminderLogStatus {
  if (action === "DONE") return "DONE";
  if (action === "SKIP") return "SKIPPED";
  return "SNOOZED";
}

async function applyReminderAck(
  userId: string,
  operation: SyncOperationInput,
): Promise<SyncOperationResult> {
  const parsed = reminderAckSyncPayloadSchema.safeParse(operation.payload);
  if (!parsed.success) return fail(operation.id, "invalid_payload");

  const payload = parsed.data;

  // --- Ownership: the reminder must belong to THIS elder. ---
  const reminder = await prisma.reminder.findFirst({
    where: { id: payload.reminderId, userId },
  });
  if (!reminder) return fail(operation.id, "not_found");

  const scheduledFor = new Date(payload.scheduledFor);
  const timeZone = await timeZoneForUser(userId);

  // --- Integrity: the instant must be a genuine occurrence. ---
  const localDay = localDayOf(scheduledFor, timeZone);
  const windowStart = zonedTimeToUtc(addDays(localDay, -1), 0, timeZone);
  const windowEnd = zonedTimeToUtc(addDays(localDay, 2), 0, timeZone);
  const isRealOccurrence = occurrencesBetween(
    toSchedule(reminder),
    windowStart,
    windowEnd,
    timeZone,
  ).some((o) => o.getTime() === scheduledFor.getTime());
  if (!isRealOccurrence) return fail(operation.id, "invalid_occurrence");

  const status = statusFor(payload.action);
  const eventAt = new Date(payload.eventAt);
  const acknowledgedAt = payload.action === "LATER" ? null : eventAt;
  const snoozedUntil =
    payload.action === "LATER"
      ? new Date(eventAt.getTime() + SNOOZE_MS)
      : null;

  const existing = await prisma.reminderLog.findUnique({
    where: {
      reminderId_scheduledFor: {
        reminderId: payload.reminderId,
        scheduledFor,
      },
    },
  });

  // --- Conflict: resolve deterministically, never blind overwrite. ---
  if (existing) {
    const resolution = resolveReminderConflict(
      { status, at: acknowledgedAt },
      { status: existing.status, at: existing.acknowledgedAt },
    );

    // The server's stored answer stands. Report success so the device
    // stops retrying; it adopts the server state on the next snapshot.
    if (resolution.winner === "server") return ok(operation.id, existing.id);

    const updated = await prisma.reminderLog.update({
      where: { id: existing.id },
      data: { status, acknowledgedAt, snoozedUntil },
      select: { id: true },
    });
    return ok(operation.id, updated.id);
  }

  const created = await prisma.reminderLog.create({
    data: {
      reminderId: payload.reminderId,
      userId,
      scheduledFor,
      status,
      acknowledgedAt,
      snoozedUntil,
    },
    select: { id: true },
  });
  return ok(operation.id, created.id);
}

// ---------------------------------------------------------------
// Personal memory recall
// ---------------------------------------------------------------

/**
 * Record one answer to one recall prompt.
 *
 * A recall event is an APPEND — there is no later state to reconcile
 * and nothing to update, so unlike a reminder acknowledgement it needs
 * no conflict rule. Replaying it must simply do nothing, which is what
 * the unique `clientEventId` gives us.
 */
async function applyMemoryRecall(
  userId: string,
  operation: SyncOperationInput,
): Promise<SyncOperationResult> {
  const parsed = memoryRecallSyncPayloadSchema.safeParse(operation.payload);
  if (!parsed.success) return fail(operation.id, "invalid_payload");

  const payload = parsed.data;

  // --- Ownership: the memory must belong to THIS elder. ---
  // Scoped by userId in the query itself rather than fetched and then
  // compared, so there is no branch in which the wrong row is read.
  const memory = await prisma.personalMemory.findFirst({
    where: { id: payload.memoryId, userId },
    select: { id: true },
  });
  if (!memory) return fail(operation.id, "not_found");

  // --- Idempotency: a replayed push must not double-count. ---
  const existing = await prisma.memoryRecallEvent.findUnique({
    where: { clientEventId: payload.clientEventId },
    select: { id: true, userId: true },
  });

  if (existing) {
    // Another person's device must never adopt this event.
    if (existing.userId !== userId) return fail(operation.id, "conflict");
    // Already recorded. Report success so the device stops retrying.
    return ok(operation.id, existing.id);
  }

  try {
    const created = await prisma.memoryRecallEvent.create({
      data: {
        userId,
        memoryId: payload.memoryId,
        clientEventId: payload.clientEventId,
        outcome: payload.outcome,
        mode: payload.mode,
        presentation: payload.presentation ?? null,
        intervalStep: payload.intervalStep ?? null,
        responseTimeMs: payload.responseTimeMs,
        occurredAt: new Date(payload.occurredAt),
      },
      select: { id: true },
    });
    return ok(operation.id, created.id);
  } catch (error) {
    // Two tabs pushing the same event can both pass the check above
    // and race to insert. The unique constraint is the real guarantee;
    // losing that race means the event IS stored, so report success
    // rather than failing an operation that achieved its purpose.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const settled = await prisma.memoryRecallEvent.findUnique({
        where: { clientEventId: payload.clientEventId },
        select: { id: true },
      });
      if (settled) return ok(operation.id, settled.id);
    }
    throw error;
  }
}
