import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import * as db from "@/lib/offline/db";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import { applyResults } from "@/lib/offline/sync";
import { toStorablePayload } from "@/lib/offline/serialization";
import type {
  CachedMemory,
  LocalMemoryRecall,
  OfflineSnapshot,
  SnapshotMemoryRecall,
  SyncOperation,
} from "@/lib/offline/types";
import { buildLaneSession, type LaneMemory } from "@/lib/memories/lane";
import { deriveState, type RetrievalEvent } from "@/lib/memories/retrieval";
import { memoryRecallSyncPayloadSchema } from "@/lib/validation/schemas";

/**
 * MEMORY LANE WITHOUT A CONNECTION.
 *
 * Run against a real IndexedDB (fake-indexeddb) rather than a mock, so
 * the store's key path and the snapshot merge are genuinely exercised.
 *
 * The behaviour being protected: a sitting played offline this morning
 * must be visible to the sitting played offline this afternoon. Without
 * that the same photographs come round again as though nothing had
 * happened, which is worse than the feature not existing — it teaches
 * somebody that the app does not remember what they just did.
 */

const USER = "user-a";
const T0 = new Date("2026-09-15T09:00:00.000Z");
const MINUTE = 60_000;
const DAY = 86_400_000;

function recall(overrides: Partial<LocalMemoryRecall> = {}): LocalMemoryRecall {
  return {
    clientEventId: "ev-1",
    memoryId: "mem-1",
    outcome: "RECOGNISED",
    mode: "CHOICE",
    presentation: "PERSON_RECOGNITION",
    intervalStep: 0,
    responseTimeMs: 3200,
    occurredAt: T0.toISOString(),
    syncStatus: "PENDING",
    ...overrides,
  };
}

function cachedMemory(overrides: Partial<CachedMemory> = {}): CachedMemory {
  return {
    id: "mem-1",
    category: "PERSON",
    title: "Meera",
    relationship: "Daughter",
    description: null,
    hasImage: true,
    hasAudio: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    userId: USER,
    contentVersion: "v1",
    snapshotAt: T0.toISOString(),
    profile: {
      id: USER,
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
    games: [],
    reminders: [],
    reminderLogs: [],
    memories: [cachedMemory()],
    sessions: [],
    memoryRecalls: [],
    ...overrides,
  };
}

function serverRecall(
  overrides: Partial<SnapshotMemoryRecall> = {},
): SnapshotMemoryRecall {
  return {
    clientEventId: "srv-1",
    memoryId: "mem-1",
    outcome: "RECOGNISED",
    mode: "CHOICE",
    presentation: "PERSON_RECOGNITION",
    intervalStep: 0,
    responseTimeMs: 2000,
    occurredAt: T0.toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  await db.clearAll();
  await repo.ensureUserScope(USER);
});

describe("an answer given with no connection", () => {
  it("is written to the device and queued", async () => {
    await repo.saveMemoryRecall(recall());
    await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: { clientEventId: "ev-1", memoryId: "mem-1" },
    });

    expect(await repo.pendingMemoryRecalls()).toHaveLength(1);
    expect(await queue.countPending()).toBe(1);
  });

  it("carries the Memory Lane fields through serialisation intact", () => {
    // `toStorablePayload` drops keys whose value carried no data, which
    // would silently strip `presentation: null` and `intervalStep: 0`
    // — the second of which is a real step, not an absence.
    const payload = toStorablePayload({
      clientEventId: "ev-1",
      memoryId: "mem-1",
      outcome: "ASSISTED",
      mode: "CHOICE",
      presentation: null,
      intervalStep: 0,
      responseTimeMs: null,
      occurredAt: T0.toISOString(),
    }) as Record<string, unknown>;

    expect(payload.presentation).toBeNull();
    expect(payload.intervalStep).toBe(0);
    expect(payload.outcome).toBe("ASSISTED");
  });

  it("produces a payload the server will accept", () => {
    const parsed = memoryRecallSyncPayloadSchema.safeParse({
      clientEventId: "a-client-event-id",
      memoryId: "mem-1",
      outcome: "ASSISTED",
      mode: "CHOICE",
      presentation: "NAME_RECALL",
      intervalStep: 4,
      responseTimeMs: null,
      occurredAt: T0.toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts a payload from a device running the older bundle", () => {
    // A queued event created before Memory Lane shipped has neither
    // new key. Rejecting it weeks later because the schema grew would
    // discard somebody's answer.
    const parsed = memoryRecallSyncPayloadSchema.safeParse({
      clientEventId: "an-old-event-id",
      memoryId: "mem-1",
      outcome: "RECOGNISED",
      mode: "CHOICE",
      responseTimeMs: 1200,
      occurredAt: T0.toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses an interval step outside the schedule", () => {
    const parsed = memoryRecallSyncPayloadSchema.safeParse({
      clientEventId: "a-client-event-id",
      memoryId: "mem-1",
      outcome: "RECOGNISED",
      mode: "CHOICE",
      intervalStep: 9999,
      responseTimeMs: null,
      occurredAt: T0.toISOString(),
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an outcome that is not one of the four", () => {
    const parsed = memoryRecallSyncPayloadSchema.safeParse({
      clientEventId: "a-client-event-id",
      memoryId: "mem-1",
      outcome: "FAILED",
      mode: "CHOICE",
      responseTimeMs: null,
      occurredAt: T0.toISOString(),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("the schedule on the device", () => {
  /** What Memory Lane itself does: fold local events into a state. */
  async function laneFor(memories: LaneMemory[], now: Date) {
    const events = await repo.allMemoryRecalls();
    const byMemory = new Map<string, RetrievalEvent[]>();
    for (const event of events) {
      const entry: RetrievalEvent = {
        outcome: event.outcome,
        occurredAt: new Date(event.occurredAt),
      };
      const list = byMemory.get(event.memoryId);
      if (list) list.push(entry);
      else byMemory.set(event.memoryId, [entry]);
    }
    return buildLaneSession(
      memories.map((memory) => ({
        memory,
        state: deriveState(byMemory.get(memory.id) ?? [], now),
      })),
      now,
    );
  }

  const MEERA: LaneMemory = {
    id: "mem-1",
    category: "PERSON",
    title: "Meera",
    relationship: "Daughter",
    description: null,
    hasImage: true,
    hasAudio: false,
  };

  it("moves on after an answer given offline, with no server involved", async () => {
    const before = await laneFor([MEERA], T0);
    expect(before.rounds).toHaveLength(1);

    await repo.saveMemoryRecall(recall({ outcome: "RECOGNISED" }));

    // Recognised at the first step → next due in a minute, so a second
    // sitting ten seconds later offers nothing.
    const tenSecondsLater = await laneFor([MEERA], new Date(T0.getTime() + 10_000));
    expect(tenSecondsLater.rounds).toHaveLength(0);
    expect(tenSecondsLater.waitingCount).toBe(1);

    const twoMinutesLater = await laneFor([MEERA], new Date(T0.getTime() + 2 * MINUTE));
    expect(twoMinutesLater.rounds).toHaveLength(1);
  });

  it("brings a missed memory back within the sitting, offline", async () => {
    await repo.saveMemoryRecall(recall({ outcome: "ASSISTED" }));
    const soon = await laneFor([MEERA], new Date(T0.getTime() + 25_000));
    expect(soon.rounds).toHaveLength(1);
  });

  it("survives answers pushed out of order", async () => {
    await repo.saveMemoryRecall(
      recall({ clientEventId: "later", occurredAt: new Date(T0.getTime() + DAY).toISOString() }),
    );
    await repo.saveMemoryRecall(
      recall({ clientEventId: "earlier", outcome: "ASSISTED" }),
    );

    // Two recognitions' worth of history in the wrong arrival order;
    // the fold sorts by when the person answered.
    const session = await laneFor([MEERA], new Date(T0.getTime() + 2 * DAY));
    expect(session.rounds.length + session.waitingCount).toBe(1);
  });
});

describe("reconnecting", () => {
  it("retires a queued answer the server accepted", async () => {
    await repo.saveMemoryRecall(recall());
    const operation = await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: {},
    });

    await applyResults([operation as SyncOperation], [
      { id: operation.id, ok: true },
    ]);

    const [stored] = await repo.allMemoryRecalls();
    expect(stored.syncStatus).toBe("SYNCED");
    expect(await queue.countPending()).toBe(0);
  });

  it("keeps an answer the server rejected, rather than discarding it", async () => {
    await repo.saveMemoryRecall(recall());
    const operation = await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: {},
    });

    await applyResults([operation as SyncOperation], [
      { id: operation.id, ok: false, errorCode: "not_found", retryable: false },
    ]);

    const [stored] = await repo.allMemoryRecalls();
    expect(stored.syncStatus).toBe("FAILED");
    // Flagged and kept, never deleted: it is a record of a real moment.
    expect(await repo.allMemoryRecalls()).toHaveLength(1);
  });
});

describe("coming back after a long time offline", () => {
  /**
   * Found by driving a real browser: two answers given offline, the
   * network restored, and one of them still sitting in the queue
   * minutes later. Nothing was broken — the earlier answer had failed
   * more times while the connection was down, so it had backed off
   * furthest and was not yet due for retry.
   *
   * Correct, and still wrong for the person: the backoff exists to
   * avoid hammering a bad network, and the network has just proved it
   * is fine. To them it looks like the app losing what they did.
   */
  it("clears the backoff so nothing waits on a connection that is back", async () => {
    const operation = await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-1",
      operation: "CREATE",
      payload: {},
    });

    // Five failed attempts while offline: a ten-minute backoff.
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      await queue.markInFlight([operation.id], now);
      await queue.markFailure(operation.id, "network");
    }
    expect(await queue.dueOperations(now)).toHaveLength(0);

    expect(await queue.resetBackoff()).toBe(1);

    expect(await queue.dueOperations(now)).toHaveLength(1);
  });

  it("leaves a permanently failed operation alone", async () => {
    const operation = await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-bad",
      operation: "CREATE",
      payload: {},
    });
    await queue.markInFlight([operation.id], new Date());
    // Not retryable: the server rejected the payload itself.
    await queue.markFailure(operation.id, "invalid");

    await queue.resetBackoff();

    // A working network does not make a rejected payload acceptable,
    // and reviving it here would be a retry loop.
    const [stored] = await queue.failedOperations();
    expect(stored.status).toBe("FAILED");
    expect(await queue.dueOperations(new Date())).toHaveLength(0);
  });

  it("leaves work parked on authentication alone", async () => {
    const operation = await queue.enqueue({
      entityType: "MEMORY_RECALL",
      entityId: "ev-auth",
      operation: "CREATE",
      payload: {},
    });
    await queue.markInFlight([operation.id], new Date());
    await queue.markFailure(operation.id, "unauthenticated");

    await queue.resetBackoff();

    const [stored] = await queue.failedOperations();
    expect(stored.status).toBe("NEEDS_AUTH");
  });
});

describe("a snapshot from the server", () => {
  it("brings down history from the person's other devices", async () => {
    // Without this, opening the tablet after answering on the phone
    // would treat a memory practised for a month as brand new.
    await repo.applySnapshot(
      snapshot({ memoryRecalls: [serverRecall(), serverRecall({ clientEventId: "srv-2" })] }),
    );

    const all = await repo.allMemoryRecalls();
    expect(all).toHaveLength(2);
    expect(all.every((e) => e.syncStatus === "SYNCED")).toBe(true);
  });

  it("does not resend an event it already has", async () => {
    await repo.applySnapshot(snapshot({ memoryRecalls: [serverRecall()] }));
    await repo.applySnapshot(snapshot({ memoryRecalls: [serverRecall()] }));

    // Keyed by clientEventId on both sides, so the union is exact —
    // and each event moves the schedule a step, so a duplicate would
    // be a real error and not merely untidy.
    expect(await repo.allMemoryRecalls()).toHaveLength(1);
  });

  it("never overwrites an answer still waiting to be sent", async () => {
    await repo.saveMemoryRecall(
      recall({ clientEventId: "mine", outcome: "ASSISTED" }),
    );

    await repo.applySnapshot(
      snapshot({
        memoryRecalls: [
          serverRecall({ clientEventId: "mine", outcome: "RECOGNISED" }),
        ],
      }),
    );

    const [stored] = await repo.allMemoryRecalls();
    // Still PENDING, still ASSISTED: retiring it here would take it
    // out of the queue without it ever having been sent.
    expect(stored.syncStatus).toBe("PENDING");
    expect(stored.outcome).toBe("ASSISTED");
  });

  it("adopts the server's copy once the local one has synced", async () => {
    await repo.saveMemoryRecall(
      recall({ clientEventId: "mine", syncStatus: "SYNCED" }),
    );
    await repo.applySnapshot(
      snapshot({
        memoryRecalls: [
          serverRecall({ clientEventId: "mine", intervalStep: 5 }),
        ],
      }),
    );

    const [stored] = await repo.allMemoryRecalls();
    expect(stored.intervalStep).toBe(5);
  });

  it("carries the familiar-voice flag, but never the recording", async () => {
    await repo.applySnapshot(
      snapshot({ memories: [cachedMemory({ hasAudio: true })] }),
    );

    const [memory] = await repo.getMemories();
    expect(memory.hasAudio).toBe(true);
    // A flag only. The recording stays behind the authenticated route
    // — a family tablet does not hold somebody's voice in a cache.
    expect(JSON.stringify(memory)).not.toContain("audio/");
    expect(Object.keys(memory)).not.toContain("audioPath");
  });

  it("tolerates an older server that sends no recall history", async () => {
    const legacy = snapshot();
    delete (legacy as Partial<OfflineSnapshot>).memoryRecalls;

    await expect(repo.applySnapshot(legacy)).resolves.toBeUndefined();
    expect(await repo.allMemoryRecalls()).toEqual([]);
  });
});

describe("a different person on the same tablet", () => {
  it("cannot see the last person's recall history", async () => {
    await repo.saveMemoryRecall(recall());
    expect(await repo.allMemoryRecalls()).toHaveLength(1);

    await repo.ensureUserScope("user-b");

    // The whole local database is cleared when a different elder signs
    // in. Cognisaarthi is built for a shared family tablet, so this is
    // the guarantee that matters most in this file.
    expect(await repo.allMemoryRecalls()).toEqual([]);
    expect(await repo.getMemories()).toEqual([]);
  });
});
