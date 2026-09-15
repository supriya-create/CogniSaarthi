import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import * as db from "@/lib/offline/db";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import { applyResults } from "@/lib/offline/sync";
import type {
  LocalMemoryRecall,
  OfflineSnapshot,
  SyncOperation,
} from "@/lib/offline/types";

/**
 * Recall answers on the device, against a real IndexedDB
 * (fake-indexeddb) rather than a mock, so the new store's key path and
 * indexes are genuinely exercised.
 *
 * The behaviours that matter here are the offline ones: an answer given
 * with no connection is kept, is not lost to a refresh or a snapshot,
 * and is never silently dropped when the server rejects it.
 */

const USER_A = "user-a";
const USER_B = "user-b";

function recall(
  overrides: Partial<LocalMemoryRecall> = {},
): LocalMemoryRecall {
  return {
    clientEventId: "ev-1",
    memoryId: "mem-1",
    outcome: "RECOGNISED",
    mode: "CHOICE",
    responseTimeMs: 3200,
    occurredAt: "2026-09-15T04:30:00.000Z",
    syncStatus: "PENDING",
    ...overrides,
  };
}

function snapshot(userId: string): OfflineSnapshot {
  return {
    userId,
    contentVersion: "v1",
    snapshotAt: "2026-09-15T05:00:00.000Z",
    profile: {
      id: userId,
      name: "Test",
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
    games: [],
    reminders: [],
    reminderLogs: [],
    memories: [],
    sessions: [],
  };
}

beforeEach(async () => {
  await db.clearAll();
  await repo.ensureUserScope(USER_A);
});

describe("an answer given offline", () => {
  it("is written to the device and waits to be sent", async () => {
    await repo.saveMemoryRecall(recall());

    const all = await repo.allMemoryRecalls();
    expect(all).toHaveLength(1);
    expect(all[0].syncStatus).toBe("PENDING");
    expect(await repo.pendingMemoryRecalls()).toHaveLength(1);
  });

  it("keeps several answers apart by their event id", async () => {
    await repo.saveMemoryRecall(recall({ clientEventId: "ev-1" }));
    await repo.saveMemoryRecall(recall({ clientEventId: "ev-2" }));
    // The same memory asked twice is two events, not one overwritten.
    await repo.saveMemoryRecall(
      recall({ clientEventId: "ev-3", outcome: "NOT_RECOGNISED" }),
    );

    expect(await repo.allMemoryRecalls()).toHaveLength(3);
  });

  it("survives a snapshot arriving from the server", async () => {
    // The golden rule of the offline layer: server data replaces the
    // cache, but never destroys work this device has not yet pushed.
    await repo.saveMemoryRecall(recall());
    await repo.applySnapshot(snapshot(USER_A));

    expect(await repo.pendingMemoryRecalls()).toHaveLength(1);
  });

  it("is cleared when a different person signs in", async () => {
    // A shared family tablet must never carry one person's answers
    // into another person's session.
    await repo.saveMemoryRecall(recall());
    await repo.ensureUserScope(USER_B);

    expect(await repo.allMemoryRecalls()).toHaveLength(0);
  });

  it("is cleared on sign-out", async () => {
    await repo.saveMemoryRecall(recall());
    await repo.clearLocalData();

    expect(await repo.allMemoryRecalls()).toHaveLength(0);
  });
});

describe("marking what the server said", () => {
  it("marks an accepted answer as synced", async () => {
    await repo.saveMemoryRecall(recall());
    await repo.markMemoryRecallSynced("ev-1");

    const all = await repo.allMemoryRecalls();
    expect(all[0].syncStatus).toBe("SYNCED");
    expect(await repo.pendingMemoryRecalls()).toHaveLength(0);
  });

  it("keeps a rejected answer, flagged rather than deleted", async () => {
    await repo.saveMemoryRecall(recall());
    await repo.markMemoryRecallFailed("ev-1");

    const all = await repo.allMemoryRecalls();
    expect(all).toHaveLength(1);
    expect(all[0].syncStatus).toBe("FAILED");
  });

  it("ignores a mark for an event this device does not have", async () => {
    await repo.markMemoryRecallSynced("never-existed");
    expect(await repo.allMemoryRecalls()).toHaveLength(0);
  });
});

describe("the sync queue", () => {
  function operation(
    id: string,
    entityId: string,
  ): SyncOperation {
    return {
      id,
      entityType: "MEMORY_RECALL",
      entityId,
      operation: "CREATE",
      payload: {},
      createdAt: "2026-09-15T04:30:00.000Z",
      attempts: 0,
      lastAttemptAt: null,
      status: "IN_FLIGHT",
      errorCode: null,
    };
  }

  it("marks the local answer synced when the server accepts it", async () => {
    await repo.saveMemoryRecall(recall());
    const op = operation("op-1", "ev-1");

    await applyResults([op], [{ id: "op-1", ok: true, serverId: "srv-1" }]);

    const all = await repo.allMemoryRecalls();
    expect(all[0].syncStatus).toBe("SYNCED");
  });

  it("leaves the answer pending when the server is retryable-unhappy", async () => {
    await repo.saveMemoryRecall(recall());
    const op = operation("op-2", "ev-1");

    await applyResults(
      [op],
      [{ id: "op-2", ok: false, errorCode: "server_error", retryable: true }],
    );

    // Still on the device, still not claimed as sent.
    const all = await repo.allMemoryRecalls();
    expect(all).toHaveLength(1);
    expect(all[0].syncStatus).not.toBe("SYNCED");
  });

  it("never drops the answer when the server rejects it outright", async () => {
    await repo.saveMemoryRecall(recall());
    await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: {},
    });
    const [queued] = await queue.dueOperations(new Date());

    await applyResults(
      [queued],
      [{ id: queued.id, ok: false, errorCode: "invalid_payload" }],
    );

    // Parked, never deleted — work is not destroyed to tidy a queue.
    const all = await repo.allMemoryRecalls();
    expect(all).toHaveLength(1);
  });

  it("does not resend an answer the server already accepted", async () => {
    await repo.saveMemoryRecall(recall());
    await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: {},
    });
    const [queued] = await queue.dueOperations(new Date());

    await applyResults([queued], [{ id: queued.id, ok: true }]);

    // Nothing left waiting, so a later sync run sends it no second time.
    expect(await queue.dueOperations(new Date())).toHaveLength(0);
  });
});

describe("what a recall event holds", () => {
  it("carries no memory content, only an id", async () => {
    await repo.saveMemoryRecall(recall());
    const [stored] = await repo.allMemoryRecalls();

    // On a shared tablet the local store must not hold a family
    // member's name or a description of a photograph.
    expect(Object.keys(stored).sort()).toEqual(
      [
        "clientEventId",
        "memoryId",
        "mode",
        "occurredAt",
        "outcome",
        "responseTimeMs",
        "syncStatus",
      ].sort(),
    );
  });

  it("keeps an unmeasured response time as null", async () => {
    await repo.saveMemoryRecall(recall({ responseTimeMs: null }));
    const [stored] = await repo.allMemoryRecalls();
    expect(stored.responseTimeMs).toBeNull();
  });
});
