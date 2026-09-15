import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { applySyncOperation } from "@/lib/sync/server";
import { zonedTimeToUtc } from "@/lib/reminders/timezone";
import type { SyncOperationInput } from "@/lib/validation/schemas";

/**
 * SERVER-SIDE SYNC: idempotency, authorization and conflict handling.
 *
 * These are the tests that matter most for Phase 5. Synchronisation
 * retries by design, and a device is an untrusted client — so replaying
 * an operation must not duplicate anything, a forged id must not reach
 * another family's data, and a client-supplied score must not be stored.
 */

const TZ = "Asia/Kolkata";
const TAG = `sync-test-${Date.now()}`;
const GAME_ID = "remember-objects";

let userA = "";
let userB = "";
let reminderA = "";
let reminderB = "";
/** 08:00 local, a genuine occurrence of the daily reminders below. */
let occurrence = new Date();

/** Rounds worth exactly 50%: 1 correct out of 2. */
const HALF_RIGHT = [
  { index: 0, correct: 1, total: 2, mistakes: 1, hintsUsed: 0, responseTimeMs: 1000 },
];

function gameOp(
  clientSessionId: string,
  overrides: Record<string, unknown> = {},
  id = `op-${Math.random().toString(36).slice(2)}`,
): SyncOperationInput {
  return {
    id,
    entityType: "GAME_SESSION",
    entityId: clientSessionId,
    operation: "CREATE",
    payload: {
      clientSessionId,
      gameId: GAME_ID,
      difficulty: "EASY",
      language: "EN",
      startedAt: "2026-09-14T02:00:00.000Z",
      completedAt: "2026-09-14T02:05:00.000Z",
      durationMs: 300_000,
      rounds: HALF_RIGHT,
      ...overrides,
    },
  };
}

function ackOp(
  reminderId: string,
  action: "DONE" | "SKIP" | "LATER",
  when: Date,
  scheduledFor: Date = occurrence,
  id = `op-${Math.random().toString(36).slice(2)}`,
): SyncOperationInput {
  return {
    id,
    entityType: "REMINDER_LOG",
    entityId: `${reminderId}|${scheduledFor.toISOString()}`,
    operation: "ACKNOWLEDGE",
    payload: {
      reminderId,
      scheduledFor: scheduledFor.toISOString(),
      action,
      eventAt: when.toISOString(),
    },
  };
}

beforeAll(async () => {
  // The catalogue row must exist for the session's foreign key.
  await prisma.game.upsert({
    where: { id: GAME_ID },
    create: {
      id: GAME_ID,
      name: "Remember the Objects",
      domain: "SHORT_TERM_MEMORY",
      shortDescription: "test",
      instructions: "test",
      iconKey: "brain",
    },
    update: {},
  });

  const uA = await prisma.user.create({
    data: { name: `${TAG}-A`, connectCode: `${TAG}-A` },
  });
  const uB = await prisma.user.create({
    data: { name: `${TAG}-B`, connectCode: `${TAG}-B` },
  });
  userA = uA.id;
  userB = uB.id;

  // Both elders get an identical daily 08:00 reminder.
  const startDate = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, 0, TZ);
  const rA = await prisma.reminder.create({
    data: {
      userId: userA,
      title: "Morning medication",
      category: "MEDICATION",
      timeMinutes: 480,
      recurrence: "DAILY",
      weekdays: [],
      startDate,
    },
  });
  const rB = await prisma.reminder.create({
    data: {
      userId: userB,
      title: "Morning medication",
      category: "MEDICATION",
      timeMinutes: 480,
      recurrence: "DAILY",
      weekdays: [],
      startDate,
    },
  });
  reminderA = rA.id;
  reminderB = rB.id;

  occurrence = zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 480, TZ);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------

describe("idempotency — a retried sync must not duplicate", () => {
  it("stores one session however many times the same one is sent", async () => {
    const clientSessionId = `${TAG}-cs-dup`;
    const first = await applySyncOperation(userA, gameOp(clientSessionId));
    const second = await applySyncOperation(userA, gameOp(clientSessionId));
    const third = await applySyncOperation(userA, gameOp(clientSessionId));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(true);
    // Every attempt resolves to the same server-side row.
    expect(second.serverId).toBe(first.serverId);
    expect(third.serverId).toBe(first.serverId);

    const count = await prisma.gameSession.count({ where: { clientSessionId } });
    expect(count).toBe(1);

    const results = await prisma.gameResult.count({
      where: { sessionId: first.serverId },
    });
    expect(results).toBe(1);
  });

  it("completes a session that was opened online and finished offline", async () => {
    const clientSessionId = `${TAG}-cs-open`;
    // The browser opened the row when play began, then lost signal.
    const opened = await prisma.gameSession.create({
      data: {
        userId: userA,
        gameId: GAME_ID,
        difficulty: "EASY",
        clientSessionId,
        roundsTotal: 1,
      },
      select: { id: true },
    });

    const result = await applySyncOperation(userA, gameOp(clientSessionId));
    expect(result.ok).toBe(true);
    // Same row completed, not a second one created.
    expect(result.serverId).toBe(opened.id);
    expect(await prisma.gameSession.count({ where: { clientSessionId } })).toBe(1);

    const session = await prisma.gameSession.findUnique({
      where: { id: opened.id },
      include: { result: true },
    });
    expect(session?.status).toBe("COMPLETED");
    expect(session?.result).not.toBeNull();
  });

  it("records one acknowledgement however many times it is sent", async () => {
    const when = new Date("2026-09-14T03:00:00Z");
    await applySyncOperation(userA, ackOp(reminderA, "DONE", when));
    await applySyncOperation(userA, ackOp(reminderA, "DONE", when));

    const logs = await prisma.reminderLog.findMany({
      where: { reminderId: reminderA, scheduledFor: occurrence },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("DONE");
  });
});

describe("the server re-scores; a device cannot decide its own result", () => {
  it("computes the score from the rounds, ignoring anything else sent", async () => {
    const clientSessionId = `${TAG}-cs-score`;
    // The payload also carries a flattering score. It has no effect:
    // the schema does not accept it and the server recomputes anyway.
    const result = await applySyncOperation(
      userA,
      gameOp(clientSessionId, { score: 100, stars: 5, accuracy: 1 }),
    );
    expect(result.ok).toBe(true);

    const stored = await prisma.gameResult.findFirst({
      where: { sessionId: result.serverId },
    });
    // 1 correct of 2 → 50, not the 100 that was sent.
    expect(stored?.score).toBe(50);
    expect(stored?.stars).toBe(2);
  });
});

describe("authorization — identity comes from the session, not the payload", () => {
  it("refuses to acknowledge another elder's reminder", async () => {
    const result = await applySyncOperation(
      userA,
      ackOp(reminderB, "DONE", new Date("2026-09-14T03:00:00Z")),
    );
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_found");

    const leaked = await prisma.reminderLog.count({
      where: { reminderId: reminderB },
    });
    expect(leaked).toBe(0);
  });

  it("ignores a forged userId in the payload", async () => {
    const clientSessionId = `${TAG}-cs-forged`;
    const op = gameOp(clientSessionId, { userId: userB });
    const result = await applySyncOperation(userA, op);
    expect(result.ok).toBe(true);

    const session = await prisma.gameSession.findUnique({
      where: { clientSessionId },
      select: { userId: true },
    });
    // Stored against the authenticated user, never the claimed one.
    expect(session?.userId).toBe(userA);
    expect(session?.userId).not.toBe(userB);
  });

  it("refuses to adopt another elder's existing session id", async () => {
    const clientSessionId = `${TAG}-cs-steal`;
    await applySyncOperation(userB, gameOp(clientSessionId));

    const result = await applySyncOperation(userA, gameOp(clientSessionId));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("conflict");

    const session = await prisma.gameSession.findUnique({
      where: { clientSessionId },
      select: { userId: true },
    });
    expect(session?.userId).toBe(userB); // untouched
  });
});

describe("validation", () => {
  it("rejects an unknown game", async () => {
    const result = await applySyncOperation(
      userA,
      gameOp(`${TAG}-cs-badgame`, { gameId: "not-a-game" }),
    );
    expect(result.errorCode).toBe("unknown_game");
  });

  it("rejects a malformed payload without retrying forever", async () => {
    const result = await applySyncOperation(userA, {
      id: "op-bad",
      entityType: "GAME_SESSION",
      entityId: "x",
      operation: "CREATE",
      payload: { nonsense: true },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid_payload");
    expect(result.retryable).toBe(false);
  });

  it("rejects an instant that is not a real occurrence", async () => {
    const notAnOccurrence = zonedTimeToUtc(
      { year: 2026, month: 9, day: 14 },
      540, // 09:00, but the reminder is at 08:00
      TZ,
    );
    const result = await applySyncOperation(
      userA,
      ackOp(reminderA, "DONE", new Date(), notAnOccurrence),
    );
    expect(result.errorCode).toBe("invalid_occurrence");
  });
});

describe("conflict handling on sync", () => {
  it("does not let a stale snooze undo an answer already recorded", async () => {
    const day = zonedTimeToUtc({ year: 2026, month: 9, day: 16 }, 480, TZ);

    // The server already knows it was done, at 10:00.
    await applySyncOperation(
      userA,
      ackOp(reminderA, "DONE", new Date("2026-09-16T10:00:00Z"), day),
    );

    // A device that was offline now pushes an older "remind me later".
    const late = await applySyncOperation(
      userA,
      ackOp(reminderA, "LATER", new Date("2026-09-16T07:00:00Z"), day),
    );

    // Accepted (so the device stops retrying) but the answer stands.
    expect(late.ok).toBe(true);
    const log = await prisma.reminderLog.findFirst({
      where: { reminderId: reminderA, scheduledFor: day },
    });
    expect(log?.status).toBe("DONE");
  });

  it("lets a genuinely newer answer replace an older one", async () => {
    const day = zonedTimeToUtc({ year: 2026, month: 9, day: 17 }, 480, TZ);

    await applySyncOperation(
      userA,
      ackOp(reminderA, "SKIP", new Date("2026-09-17T08:00:00Z"), day),
    );
    await applySyncOperation(
      userA,
      ackOp(reminderA, "DONE", new Date("2026-09-17T09:00:00Z"), day),
    );

    const log = await prisma.reminderLog.findFirst({
      where: { reminderId: reminderA, scheduledFor: day },
    });
    expect(log?.status).toBe("DONE");
  });
});

// ---------------------------------------------------------------

describe("simulated users", () => {
  it("User B — offline then reconnects: every activity arrives, none twice", async () => {
    const ids = [`${TAG}-B1`, `${TAG}-B2`, `${TAG}-B3`];

    // Three activities played with no signal, pushed on reconnect.
    for (const id of ids) {
      const result = await applySyncOperation(userA, gameOp(id));
      expect(result.ok).toBe(true);
    }

    const stored = await prisma.gameSession.count({
      where: { userId: userA, clientSessionId: { in: ids } },
    });
    expect(stored).toBe(3);
  });

  it("User C — flaky network: the same batch replayed settles at one copy each", async () => {
    const ids = [`${TAG}-C1`, `${TAG}-C2`];

    // The first attempt "succeeded" but the response never arrived, so
    // the device sends the batch again.
    for (const id of ids) await applySyncOperation(userA, gameOp(id));
    for (const id of ids) await applySyncOperation(userA, gameOp(id));

    const stored = await prisma.gameSession.count({
      where: { userId: userA, clientSessionId: { in: ids } },
    });
    expect(stored).toBe(2);
  });

  it("User E — elder's offline activity becomes visible to the caregiver", async () => {
    const clientSessionId = `${TAG}-E1`;
    await applySyncOperation(userA, gameOp(clientSessionId));

    // What the caregiver dashboard reads is the same authoritative row.
    const session = await prisma.gameSession.findFirst({
      where: { userId: userA, clientSessionId },
      include: { result: true },
    });
    expect(session?.status).toBe("COMPLETED");
    expect(session?.result?.score).toBe(50);
  });

  it("User F — an attacker syncing someone else's entity is refused", async () => {
    const attempts = [
      // Another elder's reminder.
      await applySyncOperation(userB, ackOp(reminderA, "DONE", new Date())),
      // Another elder's session id.
      await applySyncOperation(userB, gameOp(`${TAG}-cs-dup`)),
    ];
    for (const attempt of attempts) {
      expect(attempt.ok).toBe(false);
    }
  });
});
