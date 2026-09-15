import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import * as db from "@/lib/offline/db";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import { occurrenceKey } from "@/lib/offline/serialization";
import type {
  LocalGameSession,
  LocalReminderLog,
  OfflineSnapshot,
} from "@/lib/offline/types";

/**
 * The local replica and the queue, exercised against a real IndexedDB
 * implementation (fake-indexeddb) rather than a hand-rolled mock — so
 * transactions, key paths and indexes are genuinely tested.
 *
 * The behaviours that matter: activity survives a "refresh", a snapshot
 * never destroys unsynced work, and a shared tablet never mixes two
 * people up.
 */

const USER_A = "user-a";
const USER_B = "user-b";

function session(overrides: Partial<LocalGameSession> = {}): LocalGameSession {
  return {
    clientSessionId: "cs-1",
    userId: USER_A,
    gameId: "remember-objects",
    difficulty: "EASY",
    language: "EN",
    startedAt: "2026-09-14T02:00:00.000Z",
    completedAt: "2026-09-14T02:05:00.000Z",
    durationMs: 300_000,
    rounds: [
      { index: 0, correct: 3, total: 3, mistakes: 0, hintsUsed: 0, responseTimeMs: 900 },
    ],
    score: 100,
    accuracy: 1,
    stars: 5,
    status: "COMPLETED",
    syncStatus: "PENDING",
    createdAt: "2026-09-14T02:05:00.000Z",
    serverSessionId: null,
    ...overrides,
  };
}

function reminderLog(
  overrides: Partial<LocalReminderLog> = {},
): LocalReminderLog {
  const reminderId = overrides.reminderId ?? "rem-1";
  const scheduledFor = overrides.scheduledFor ?? "2026-09-14T02:30:00.000Z";
  return {
    key: occurrenceKey(reminderId, scheduledFor),
    reminderId,
    scheduledFor,
    status: "DONE",
    acknowledgedAt: "2026-09-14T03:00:00.000Z",
    snoozedUntil: null,
    syncStatus: "PENDING",
    fromServer: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    userId: USER_A,
    contentVersion: "v1",
    snapshotAt: "2026-09-14T04:00:00.000Z",
    profile: {
      id: USER_A,
      name: "Supriya",
      avatarId: "marigold",
      language: "EN",
      fontScale: "COMFORTABLE",
      reduceMotion: false,
      voiceEnabled: false,
      autoReadInstructions: false,
      speechRate: "NORMAL",
      timeZone: "Asia/Kolkata",
      reminderVoice: true,
      autoReadReminders: false,
      notificationSound: true,
    },
    games: [
      {
        id: "remember-objects",
        name: "Remember the Objects",
        domain: "SHORT_TERM_MEMORY",
        iconKey: "brain",
        sortOrder: 0,
        recommendedDifficulty: "MEDIUM",
      },
    ],
    reminders: [],
    reminderLogs: [],
    memories: [],
    sessions: [],
    memoryRecalls: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await db.clearAll();
  await db.setMeta("userId", USER_A);
});

describe("game sessions survive locally", () => {
  it("saves and reads a completed activity back", async () => {
    await repo.saveLocalSession(session());
    const read = await repo.getLocalSession("cs-1");
    expect(read?.score).toBe(100);
    expect(read?.rounds).toHaveLength(1);
    expect(read?.syncStatus).toBe("PENDING");
  });

  it("lists what is still waiting to reach the server", async () => {
    await repo.saveLocalSession(session({ clientSessionId: "cs-1" }));
    await repo.saveLocalSession(
      session({ clientSessionId: "cs-2", syncStatus: "SYNCED" }),
    );
    const pending = await repo.pendingSessions();
    expect(pending.map((s) => s.clientSessionId)).toEqual(["cs-1"]);
  });

  it("records the server id once accepted", async () => {
    await repo.saveLocalSession(session());
    await repo.markSessionSynced("cs-1", "server-123");
    const read = await repo.getLocalSession("cs-1");
    expect(read?.syncStatus).toBe("SYNCED");
    expect(read?.serverSessionId).toBe("server-123");
  });

  it("keeps the activity even when syncing fails for good", async () => {
    await repo.saveLocalSession(session());
    await repo.markSessionFailed("cs-1");
    const read = await repo.getLocalSession("cs-1");
    // Flagged, but emphatically still there.
    expect(read).not.toBeNull();
    expect(read?.syncStatus).toBe("FAILED");
    expect(read?.score).toBe(100);
  });
});

describe("reminder answers survive locally", () => {
  it("saves and reads an answer by occurrence", async () => {
    await repo.saveReminderLog(reminderLog());
    const read = await repo.getReminderLog("rem-1", "2026-09-14T02:30:00.000Z");
    expect(read?.status).toBe("DONE");
  });

  it("answering the same occurrence twice replaces, never duplicates", async () => {
    await repo.saveReminderLog(reminderLog({ status: "SNOOZED" }));
    await repo.saveReminderLog(reminderLog({ status: "DONE" }));
    const all = await repo.allReminderLogs();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("DONE");
  });
});

describe("applying a snapshot", () => {
  it("fills the caches and records when it happened", async () => {
    await repo.applySnapshot(snapshot());
    expect((await repo.getProfile())?.name).toBe("Supriya");
    expect(await repo.getGames()).toHaveLength(1);
    expect((await repo.snapshotAt())?.toISOString()).toBe(
      "2026-09-14T04:00:00.000Z",
    );
  });

  it("does NOT destroy an unsynced local answer", async () => {
    // Answered "done" here while offline…
    await repo.saveReminderLog(reminderLog({ status: "DONE" }));

    // …and the server still thinks it was missed.
    await repo.applySnapshot(
      snapshot({
        reminderLogs: [
          {
            reminderId: "rem-1",
            scheduledFor: "2026-09-14T02:30:00.000Z",
            status: "MISSED",
            acknowledgedAt: null,
            snoozedUntil: null,
          },
        ],
      }),
    );

    const read = await repo.getReminderLog("rem-1", "2026-09-14T02:30:00.000Z");
    // The person's answer stands, and is still queued to be pushed.
    expect(read?.status).toBe("DONE");
    expect(read?.syncStatus).toBe("PENDING");
  });

  it("adopts the server's answer when the server's is the real one", async () => {
    await repo.saveReminderLog(
      reminderLog({ status: "SNOOZED", acknowledgedAt: null }),
    );

    await repo.applySnapshot(
      snapshot({
        reminderLogs: [
          {
            reminderId: "rem-1",
            scheduledFor: "2026-09-14T02:30:00.000Z",
            status: "DONE",
            acknowledgedAt: "2026-09-14T05:00:00.000Z",
            snoozedUntil: null,
          },
        ],
      }),
    );

    const read = await repo.getReminderLog("rem-1", "2026-09-14T02:30:00.000Z");
    expect(read?.status).toBe("DONE");
    expect(read?.syncStatus).toBe("SYNCED");
  });

  it("does not overwrite a local session that has not synced", async () => {
    await repo.saveLocalSession(session({ score: 100 }));
    await repo.applySnapshot(snapshot());
    const read = await repo.getLocalSession("cs-1");
    expect(read?.syncStatus).toBe("PENDING");
    expect(read?.score).toBe(100);
  });

  it("adopts the server's authoritative score once it knows the session", async () => {
    await repo.saveLocalSession(session({ score: 100, stars: 5 }));
    await repo.applySnapshot(
      snapshot({
        sessions: [
          {
            serverSessionId: "server-9",
            clientSessionId: "cs-1",
            gameId: "remember-objects",
            difficulty: "EASY",
            language: "EN",
            startedAt: "2026-09-14T02:00:00.000Z",
            completedAt: "2026-09-14T02:05:00.000Z",
            status: "COMPLETED",
            score: 67,
            accuracy: 0.67,
            stars: 3,
            durationMs: 300_000,
          },
        ],
      }),
    );

    const read = await repo.getLocalSession("cs-1");
    expect(read?.score).toBe(67); // the server's recomputed value wins
    expect(read?.serverSessionId).toBe("server-9");
    expect(read?.syncStatus).toBe("SYNCED");
  });
});

describe("a shared family tablet", () => {
  it("clears the previous person's data when someone else signs in", async () => {
    await repo.saveLocalSession(session());
    expect(await repo.allLocalSessions()).toHaveLength(1);

    await repo.ensureUserScope(USER_B);

    expect(await repo.allLocalSessions()).toHaveLength(0);
    expect(await repo.localUserId()).toBe(USER_B);
  });

  it("keeps data when the same person returns", async () => {
    await repo.saveLocalSession(session());
    await repo.ensureUserScope(USER_A);
    expect(await repo.allLocalSessions()).toHaveLength(1);
  });

  it("wipes everything on sign-out", async () => {
    await repo.saveLocalSession(session());
    await repo.saveReminderLog(reminderLog());
    await repo.clearLocalData();
    expect(await repo.allLocalSessions()).toHaveLength(0);
    expect(await repo.allReminderLogs()).toHaveLength(0);
  });
});

describe("the sync queue", () => {
  it("enqueues work and reports it as pending", async () => {
    await queue.enqueue({
      entityType: "GAME_SESSION",
      entityId: "cs-1",
      operation: "CREATE",
      payload: { gameId: "remember-objects" },
    });
    expect(await queue.countPending()).toBe(1);
    expect(await queue.dueOperations()).toHaveLength(1);
  });

  it("replaces an earlier queued answer for the same thing", async () => {
    const key = occurrenceKey("rem-1", "2026-09-14T02:30:00.000Z");
    await queue.enqueue({
      entityType: "REMINDER_LOG",
      entityId: key,
      operation: "ACKNOWLEDGE",
      payload: { action: "LATER" },
    });
    await queue.enqueue({
      entityType: "REMINDER_LOG",
      entityId: key,
      operation: "ACKNOWLEDGE",
      payload: { action: "DONE" },
    });

    const all = await queue.allOperations();
    expect(all).toHaveLength(1);
    expect((all[0].payload as { action: string }).action).toBe("DONE");
  });

  it("removes an operation once it has been accepted", async () => {
    const op = await queue.enqueue({
      entityType: "GAME_SESSION",
      entityId: "cs-1",
      operation: "CREATE",
      payload: {},
    });
    await queue.markDone(op.id);
    expect(await queue.countPending()).toBe(0);
    expect(await queue.allOperations()).toHaveLength(0);
  });

  it("retries a blip, then parks it — but never deletes it", async () => {
    const op = await queue.enqueue({
      entityType: "GAME_SESSION",
      entityId: "cs-1",
      operation: "CREATE",
      payload: {},
    });

    // A few network failures keep it pending for another go.
    for (let i = 0; i < 2; i++) {
      await queue.markInFlight([op.id]);
      expect(await queue.markFailure(op.id, "network")).toBe("PENDING");
    }

    // Enough of them and it is parked for inspection.
    for (let i = 0; i < queue.MAX_ATTEMPTS; i++) {
      await queue.markInFlight([op.id]);
      await queue.markFailure(op.id, "network");
    }

    const failed = await queue.failedOperations();
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe(op.id);
    // Still on disk: the user's activity is never thrown away.
    expect(await queue.allOperations()).toHaveLength(1);
  });

  it("parks a rejected operation immediately, without burning retries", async () => {
    const op = await queue.enqueue({
      entityType: "REMINDER_LOG",
      entityId: "k",
      operation: "ACKNOWLEDGE",
      payload: {},
    });
    await queue.markInFlight([op.id]);
    expect(await queue.markFailure(op.id, "invalid_payload")).toBe("FAILED");
  });

  it("waits for a sign-in, then queues the work again", async () => {
    const op = await queue.enqueue({
      entityType: "GAME_SESSION",
      entityId: "cs-1",
      operation: "CREATE",
      payload: {},
    });
    await queue.markInFlight([op.id]);
    expect(await queue.markFailure(op.id, "unauthenticated")).toBe("NEEDS_AUTH");
    expect(await queue.countPending()).toBe(0);

    expect(await queue.retryAuthBlocked()).toBe(1);
    expect(await queue.countPending()).toBe(1);
  });
});
