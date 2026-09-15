import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  getLaneSummary,
  getMemoryAudioFor,
  getScheduledMemories,
  getScheduledMemoriesForCaregiver,
} from "@/lib/memories/server";
import { applySyncOperation } from "@/lib/sync/server";
import { buildSnapshot } from "@/lib/sync/snapshot";
import { HOLDING_STEP, retentionStatus } from "@/lib/memories/retrieval";

/**
 * SECURITY AND PERSISTENCE FOR MEMORY LANE, against the real database.
 *
 * Two separate families are created, and the question asked throughout
 * is the one that matters on a shared device: can anybody reach a
 * memory, a recall history or a recording that is not theirs?
 *
 * Recall events are also exercised end to end here — persisted,
 * de-duplicated, and folded back into a schedule — because the
 * idempotency guarantee is a property of a UNIQUE INDEX and cannot be
 * tested without the database that holds it.
 */

const TAG = `lane-authz-${Date.now()}`;
let userA = "";
let userB = "";
let caregiverA = "";
let caregiverB = "";
let memoryOfA = "";
let memoryOfB = "";

const T0 = new Date("2026-09-15T09:00:00.000Z");

/** Push one recall event through the real sync path. */
async function push(
  userId: string,
  payload: Record<string, unknown>,
  id = `op-${Math.random()}`,
) {
  return applySyncOperation(userId, {
    id,
    entityType: "MEMORY_RECALL",
    entityId: String(payload.clientEventId),
    operation: "CREATE",
    payload,
  });
}

function recallPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: `${TAG}-event-${Math.random().toString(36).slice(2)}`,
    memoryId: memoryOfA,
    outcome: "RECOGNISED",
    mode: "CHOICE",
    presentation: "PERSON_RECOGNITION",
    intervalStep: 0,
    responseTimeMs: 2400,
    occurredAt: T0.toISOString(),
    ...overrides,
  };
}

beforeAll(async () => {
  const uA = await prisma.user.create({
    data: { name: `${TAG}-userA`, connectCode: `${TAG}-A`.slice(0, 40) },
  });
  const uB = await prisma.user.create({
    data: { name: `${TAG}-userB`, connectCode: `${TAG}-B`.slice(0, 40) },
  });
  const cA = await prisma.caregiver.create({
    data: { name: `${TAG}-cgA`, email: `${TAG}-a@test.local`, passwordHash: "x" },
  });
  const cB = await prisma.caregiver.create({
    data: { name: `${TAG}-cgB`, email: `${TAG}-b@test.local`, passwordHash: "x" },
  });

  await prisma.caregiverLink.create({
    data: { caregiverId: cA.id, userId: uA.id, status: "ACTIVE" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: cB.id, userId: uB.id, status: "ACTIVE" },
  });

  const mA = await prisma.personalMemory.create({
    data: {
      userId: uA.id,
      caregiverId: cA.id,
      category: "PERSON",
      title: "Meera",
      relationship: "Daughter",
      enabled: true,
      imagePath: "not-a-real-file.png",
    },
  });
  const mB = await prisma.personalMemory.create({
    data: {
      userId: uB.id,
      caregiverId: cB.id,
      category: "PLACE",
      title: "The house in Jorhat",
      enabled: true,
    },
  });

  await prisma.memoryAudio.create({
    data: {
      memoryId: mA.id,
      caregiverId: cA.id,
      path: "not-a-real-file.webm",
      mimeType: "audio/webm",
      bytes: 1234,
      durationMs: 2400,
    },
  });

  userA = uA.id;
  userB = uB.id;
  caregiverA = cA.id;
  caregiverB = cB.id;
  memoryOfA = mA.id;
  memoryOfB = mB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.caregiver.deleteMany({
    where: { id: { in: [caregiverA, caregiverB] } },
  });
  await prisma.$disconnect();
});

describe("who can see a schedule", () => {
  it("gives a caregiver the schedule for their own elder", async () => {
    const rows = await getScheduledMemoriesForCaregiver(caregiverA, userA);
    expect(rows).not.toBeNull();
    expect(rows!.map((r) => r.memory.title)).toContain("Meera");
  });

  it("gives another family's caregiver nothing at all", async () => {
    // Null rather than an empty list: "you may not see this" and
    // "there is nothing here" are different answers.
    expect(await getScheduledMemoriesForCaregiver(caregiverB, userA)).toBeNull();
    expect(await getScheduledMemoriesForCaregiver(caregiverA, userB)).toBeNull();
  });

  it("never mixes two elders' memories together", async () => {
    const a = await getScheduledMemories(userA);
    const b = await getScheduledMemories(userB);
    expect(a.map((r) => r.memory.id)).toEqual([memoryOfA]);
    expect(b.map((r) => r.memory.id)).toEqual([memoryOfB]);
  });

  it("reports whether a familiar voice exists without leaking its path", async () => {
    const [row] = await getScheduledMemories(userA);
    expect(row.memory.hasAudio).toBe(true);
    expect(JSON.stringify(row.memory)).not.toContain("not-a-real-file.webm");
  });
});

describe("who can hear a recording", () => {
  it("lets the elder it belongs to", async () => {
    const audio = await getMemoryAudioFor(memoryOfA, { userId: userA });
    expect(audio?.path).toBe("not-a-real-file.webm");
  });

  it("lets a caregiver linked to that elder", async () => {
    const audio = await getMemoryAudioFor(memoryOfA, { caregiverId: caregiverA });
    expect(audio?.mimeType).toBe("audio/webm");
  });

  it("refuses another elder", async () => {
    expect(await getMemoryAudioFor(memoryOfA, { userId: userB })).toBeNull();
  });

  it("refuses a caregiver from another family", async () => {
    expect(
      await getMemoryAudioFor(memoryOfA, { caregiverId: caregiverB }),
    ).toBeNull();
  });

  it("refuses a signed-out visitor", async () => {
    expect(await getMemoryAudioFor(memoryOfA, {})).toBeNull();
    expect(
      await getMemoryAudioFor(memoryOfA, { userId: null, caregiverId: null }),
    ).toBeNull();
  });

  it("answers the same way for a memory with no recording", async () => {
    // Indistinguishable from "not yours", so an id cannot be probed.
    expect(await getMemoryAudioFor(memoryOfB, { userId: userB })).toBeNull();
    expect(await getMemoryAudioFor("does-not-exist", { userId: userA })).toBeNull();
  });
});

describe("recording a recall answer", () => {
  it("persists the Memory Lane fields", async () => {
    const payload = recallPayload({
      outcome: "ASSISTED",
      presentation: "NAME_RECALL",
      intervalStep: 4,
    });
    const result = await push(userA, payload);
    expect(result.ok).toBe(true);

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId: String(payload.clientEventId) },
    });
    expect(stored?.outcome).toBe("ASSISTED");
    expect(stored?.presentation).toBe("NAME_RECALL");
    expect(stored?.intervalStep).toBe(4);
    expect(stored?.occurredAt.toISOString()).toBe(T0.toISOString());
  });

  it("stores nulls for an event from a device that predates Memory Lane", async () => {
    const payload = recallPayload();
    delete (payload as Record<string, unknown>).presentation;
    delete (payload as Record<string, unknown>).intervalStep;

    expect((await push(userA, payload)).ok).toBe(true);

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId: String(payload.clientEventId) },
    });
    // Null rather than a back-filled guess: nobody observed a
    // presentation mode for this prompt, so inventing one would be
    // recording something that did not happen.
    expect(stored?.presentation).toBeNull();
    expect(stored?.intervalStep).toBeNull();
  });

  it("is idempotent — a replayed push creates nothing", async () => {
    const payload = recallPayload();

    const first = await push(userA, payload);
    const second = await push(userA, payload);
    const third = await push(userA, payload);

    expect(first.ok && second.ok && third.ok).toBe(true);
    // The same server id every time, and exactly one row: a flaky
    // connection must not inflate how often somebody was asked, which
    // is precisely the signal the schedule depends on.
    expect(second.serverId).toBe(first.serverId);
    expect(third.serverId).toBe(first.serverId);
    expect(
      await prisma.memoryRecallEvent.count({
        where: { clientEventId: String(payload.clientEventId) },
      }),
    ).toBe(1);
  });

  it("refuses an answer about another elder's memory", async () => {
    const result = await push(userA, recallPayload({ memoryId: memoryOfB }));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_found");
  });

  it("refuses an answer about a memory that does not exist", async () => {
    const result = await push(userA, recallPayload({ memoryId: "nope" }));
    expect(result.ok).toBe(false);
  });

  it("refuses another device adopting an event id that is not theirs", async () => {
    const payload = recallPayload();
    expect((await push(userA, payload)).ok).toBe(true);

    const stolen = await push(userB, {
      ...payload,
      memoryId: memoryOfB,
    });
    expect(stolen.ok).toBe(false);
    expect(stolen.errorCode).toBe("conflict");
  });

  it("refuses a malformed payload without writing anything", async () => {
    const before = await prisma.memoryRecallEvent.count({ where: { userId: userA } });
    const result = await push(userA, recallPayload({ outcome: "FAILED" }));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid_payload");
    expect(
      await prisma.memoryRecallEvent.count({ where: { userId: userA } }),
    ).toBe(before);
  });
});

describe("the schedule derived from stored events", () => {
  beforeAll(async () => {
    // A clean history for this block: recognised at every step up to
    // and including the holding one.
    await prisma.memoryRecallEvent.deleteMany({ where: { userId: userA } });

    for (let step = 0; step < HOLDING_STEP; step++) {
      await push(
        userA,
        recallPayload({
          intervalStep: step,
          occurredAt: new Date(T0.getTime() + step * 60_000).toISOString(),
        }),
      );
    }
  });

  it("reads back as HOLDING", async () => {
    const [row] = await getScheduledMemories(userA, new Date(T0.getTime() + 86_400_000));
    expect(row.state.step).toBe(HOLDING_STEP);
    expect(retentionStatus(row.state)).toBe("HOLDING");
  });

  it("becomes NEEDS_REINFORCEMENT after a later miss", async () => {
    await push(
      userA,
      recallPayload({
        outcome: "NOT_RECOGNISED",
        intervalStep: HOLDING_STEP,
        occurredAt: new Date(T0.getTime() + 30 * 86_400_000).toISOString(),
      }),
    );

    const [row] = await getScheduledMemories(
      userA,
      new Date(T0.getTime() + 31 * 86_400_000),
    );
    expect(retentionStatus(row.state)).toBe("NEEDS_REINFORCEMENT");
  });

  it("returns the history newest first, for the caregiver timeline", async () => {
    const [row] = await getScheduledMemories(userA);
    const times = row.events.map((e) => e.occurredAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("counts what is due without carrying any memory content", async () => {
    const summary = await getLaneSummary(
      userA,
      new Date(T0.getTime() + 60 * 86_400_000),
    );
    expect(summary.total).toBe(1);
    expect(summary.dueCount).toBe(1);
    // Numbers only — the home screen has no business carrying a
    // family member's name to decide whether to show one line.
    expect(JSON.stringify(summary)).not.toContain("Meera");
  });
});

describe("the offline snapshot", () => {
  it("carries this elder's recall history and nobody else's", async () => {
    const snapshot = await buildSnapshot(userA);
    expect(snapshot).not.toBeNull();

    expect(snapshot!.memoryRecalls.length).toBeGreaterThan(0);
    for (const event of snapshot!.memoryRecalls) {
      expect(event.memoryId).toBe(memoryOfA);
    }
    expect(snapshot!.memories.map((m) => m.id)).toEqual([memoryOfA]);
  });

  it("carries the familiar-voice flag and not the file", async () => {
    const snapshot = await buildSnapshot(userA);
    expect(snapshot!.memories[0].hasAudio).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("not-a-real-file.webm");
  });

  it("carries no recall history for an elder who has none", async () => {
    const snapshot = await buildSnapshot(userB);
    expect(snapshot!.memoryRecalls).toEqual([]);
  });
});

describe("deleting a memory", () => {
  it("takes its recall history and its recording with it", async () => {
    const memory = await prisma.personalMemory.create({
      data: {
        userId: userA,
        caregiverId: caregiverA,
        category: "THING",
        title: `${TAG}-temp`,
      },
    });
    await prisma.memoryAudio.create({
      data: {
        memoryId: memory.id,
        caregiverId: caregiverA,
        path: "temp.webm",
        mimeType: "audio/webm",
        bytes: 10,
      },
    });
    await push(userA, recallPayload({ memoryId: memory.id }));

    await prisma.personalMemory.delete({ where: { id: memory.id } });

    // Cascades, so removing a photograph cannot leave a record of how
    // somebody answered questions about it.
    expect(
      await prisma.memoryRecallEvent.count({ where: { memoryId: memory.id } }),
    ).toBe(0);
    expect(
      await prisma.memoryAudio.count({ where: { memoryId: memory.id } }),
    ).toBe(0);
  });
});
