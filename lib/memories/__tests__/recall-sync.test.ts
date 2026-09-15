import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { applySyncOperation } from "@/lib/sync/server";
import type { SyncOperationInput } from "@/lib/validation/schemas";

/**
 * PERSONAL MEMORY RECALL — persistence, authorization and idempotency.
 *
 * Recall events are the most sensitive record in the product: whether
 * somebody recognised a photograph of their own daughter. Three things
 * have to hold before that is worth storing at all.
 *
 *  1. It reaches the right person's record and nobody else's.
 *  2. A retried sync does not inflate it. These events will become the
 *     input to Memory Lane, so a duplicate is not a cosmetic bug — it
 *     is a false claim that somebody was asked twice.
 *  3. "Skipped" stays distinct from "did not recognise". Collapsing
 *     them would turn "I'd rather stop" into a record of failure.
 */

const TAG = `recall-test-${Date.now()}`;

let userA = "";
let userB = "";
let caregiverId = "";
let memoryA = "";
let memoryB = "";

function recallOp(
  memoryId: string,
  clientEventId: string,
  overrides: Record<string, unknown> = {},
  id = `op-${Math.random().toString(36).slice(2)}`,
): SyncOperationInput {
  return {
    id,
    entityType: "MEMORY_RECALL",
    entityId: clientEventId,
    operation: "CREATE",
    payload: {
      clientEventId,
      memoryId,
      outcome: "RECOGNISED",
      mode: "CHOICE",
      responseTimeMs: 4200,
      occurredAt: "2026-09-15T04:30:00.000Z",
      ...overrides,
    },
  };
}

beforeAll(async () => {
  const uA = await prisma.user.create({
    data: { name: `${TAG}-A`, connectCode: `${TAG}-A` },
  });
  const uB = await prisma.user.create({
    data: { name: `${TAG}-B`, connectCode: `${TAG}-B` },
  });
  userA = uA.id;
  userB = uB.id;

  const caregiver = await prisma.caregiver.create({
    data: {
      name: `${TAG}-cg`,
      email: `${TAG}@example.test`,
      passwordHash: "not-a-real-hash",
    },
  });
  caregiverId = caregiver.id;

  // One memory each, so "another family's memory" is a real case.
  const mA = await prisma.personalMemory.create({
    data: {
      userId: userA,
      caregiverId,
      category: "PERSON",
      title: "Daughter",
      relationship: "Daughter",
    },
  });
  const mB = await prisma.personalMemory.create({
    data: {
      userId: userB,
      caregiverId,
      category: "PLACE",
      title: "The old house",
    },
  });
  memoryA = mA.id;
  memoryB = mB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.caregiver.deleteMany({ where: { id: caregiverId } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------

describe("recording an answer", () => {
  it("stores one event against the right person and memory", async () => {
    const clientEventId = `${TAG}-create-1`;
    const result = await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId),
    );

    expect(result.ok).toBe(true);

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    expect(stored?.userId).toBe(userA);
    expect(stored?.memoryId).toBe(memoryA);
    expect(stored?.outcome).toBe("RECOGNISED");
    expect(stored?.mode).toBe("CHOICE");
    expect(stored?.responseTimeMs).toBe(4200);
  });

  it("keeps the device's event time, not the arrival time", async () => {
    // An answer given offline can arrive days later. The moment that
    // matters is when the person answered.
    const clientEventId = `${TAG}-create-2`;
    await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId, {
        occurredAt: "2026-09-10T06:00:00.000Z",
      }),
    );

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    expect(stored?.occurredAt.toISOString()).toBe("2026-09-10T06:00:00.000Z");
  });

  it("records an unmeasured response time as null, never zero", async () => {
    const clientEventId = `${TAG}-create-3`;
    await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId, { responseTimeMs: null }),
    );

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    // Zero would read as "answered instantly", which is a claim.
    expect(stored?.responseTimeMs).toBeNull();
  });

  it("keeps SKIPPED distinct from NOT_RECOGNISED", async () => {
    const skipped = `${TAG}-skip`;
    const missed = `${TAG}-missed`;

    await applySyncOperation(
      userA,
      recallOp(memoryA, skipped, { outcome: "SKIPPED" }),
    );
    await applySyncOperation(
      userA,
      recallOp(memoryA, missed, { outcome: "NOT_RECOGNISED" }),
    );

    const a = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId: skipped },
    });
    const b = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId: missed },
    });
    expect(a?.outcome).toBe("SKIPPED");
    expect(b?.outcome).toBe("NOT_RECOGNISED");
  });

  it("records a spoken answer as VOICE", async () => {
    // Speech recognition mishears, so a VOICE miss is weaker evidence
    // than a CHOICE miss and must stay distinguishable.
    const clientEventId = `${TAG}-voice`;
    await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId, { mode: "VOICE" }),
    );

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    expect(stored?.mode).toBe("VOICE");
  });
});

describe("authorization", () => {
  it("refuses an event against another family's memory", async () => {
    const result = await applySyncOperation(
      userB,
      recallOp(memoryA, `${TAG}-forged`),
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_found");

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId: `${TAG}-forged` },
    });
    expect(stored).toBeNull();
  });

  it("refuses an event against a memory that does not exist", async () => {
    const result = await applySyncOperation(
      userA,
      recallOp("no-such-memory-id", `${TAG}-ghost`),
    );
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_found");
  });

  it("never lets one device adopt another person's event id", async () => {
    const clientEventId = `${TAG}-adopt`;
    await applySyncOperation(userA, recallOp(memoryA, clientEventId));

    // User B replays A's event id against B's own memory.
    const result = await applySyncOperation(
      userB,
      recallOp(memoryB, clientEventId),
    );
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("conflict");

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    expect(stored?.userId).toBe(userA);
    expect(stored?.memoryId).toBe(memoryA);
  });

  it("takes identity from the session, never from the payload", async () => {
    // A `userId` in the payload is not in the schema, so it is dropped
    // rather than honoured.
    const clientEventId = `${TAG}-payload-identity`;
    await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId, { userId: userB }),
    );

    const stored = await prisma.memoryRecallEvent.findUnique({
      where: { clientEventId },
    });
    expect(stored?.userId).toBe(userA);
  });
});

describe("idempotency — a retried sync must not inflate the record", () => {
  it("replaying the same event stores exactly one row", async () => {
    const clientEventId = `${TAG}-replay`;

    const first = await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId),
    );
    const second = await applySyncOperation(
      userA,
      recallOp(memoryA, clientEventId),
    );

    // Both report success: the device must stop retrying either way.
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.serverId).toBe(first.serverId);

    const count = await prisma.memoryRecallEvent.count({
      where: { clientEventId },
    });
    expect(count).toBe(1);
  });

  it("a whole batch replayed settles at one copy each", async () => {
    const ids = [`${TAG}-batch-1`, `${TAG}-batch-2`, `${TAG}-batch-3`];

    // The response to the first attempt never arrived, so the device
    // sends the entire batch again.
    for (const id of ids) {
      await applySyncOperation(userA, recallOp(memoryA, id));
    }
    for (const id of ids) {
      await applySyncOperation(userA, recallOp(memoryA, id));
    }

    const count = await prisma.memoryRecallEvent.count({
      where: { clientEventId: { in: ids } },
    });
    expect(count).toBe(3);
  });

  it("survives two devices racing on the same event id", async () => {
    const clientEventId = `${TAG}-race`;

    const [a, b] = await Promise.all([
      applySyncOperation(userA, recallOp(memoryA, clientEventId)),
      applySyncOperation(userA, recallOp(memoryA, clientEventId)),
    ]);

    // Whoever loses the unique-constraint race still succeeds: the
    // event IS stored, which is what the operation set out to achieve.
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const count = await prisma.memoryRecallEvent.count({
      where: { clientEventId },
    });
    expect(count).toBe(1);
  });

  it("does not merge two genuinely different answers", async () => {
    // Same memory, same person, two separate askings.
    const ids = [`${TAG}-distinct-1`, `${TAG}-distinct-2`];
    await applySyncOperation(userA, recallOp(memoryA, ids[0]));
    await applySyncOperation(
      userA,
      recallOp(memoryA, ids[1], { outcome: "NOT_RECOGNISED" }),
    );

    const stored = await prisma.memoryRecallEvent.findMany({
      where: { clientEventId: { in: ids } },
      orderBy: { clientEventId: "asc" },
    });
    expect(stored).toHaveLength(2);
    expect(stored[0].outcome).toBe("RECOGNISED");
    expect(stored[1].outcome).toBe("NOT_RECOGNISED");
  });
});

describe("payload validation", () => {
  it("rejects an unknown outcome", async () => {
    const result = await applySyncOperation(userA, {
      id: "op-bad-outcome",
      entityType: "MEMORY_RECALL",
      entityId: `${TAG}-bad`,
      operation: "CREATE",
      payload: {
        clientEventId: `${TAG}-bad-outcome`,
        memoryId: memoryA,
        outcome: "DIAGNOSED",
        mode: "CHOICE",
        responseTimeMs: 100,
        occurredAt: "2026-09-15T04:30:00.000Z",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid_payload");
  });

  it("rejects a missing idempotency key", async () => {
    const result = await applySyncOperation(userA, {
      id: "op-no-key",
      entityType: "MEMORY_RECALL",
      entityId: `${TAG}-nokey`,
      operation: "CREATE",
      payload: {
        memoryId: memoryA,
        outcome: "RECOGNISED",
        mode: "CHOICE",
        responseTimeMs: 100,
        occurredAt: "2026-09-15T04:30:00.000Z",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid_payload");
  });

  it("rejects a nonsense response time", async () => {
    const result = await applySyncOperation(
      userA,
      recallOp(memoryA, `${TAG}-slow`, { responseTimeMs: 999_999_999 }),
    );
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("invalid_payload");
  });
});

describe("deletion", () => {
  it("removes recall events with the person", async () => {
    // The events name a memory of a family member. They must not
    // outlive the account by way of a missing cascade.
    const user = await prisma.user.create({
      data: { name: `${TAG}-del`, connectCode: `${TAG}-del` },
    });
    const memory = await prisma.personalMemory.create({
      data: {
        userId: user.id,
        caregiverId,
        category: "PERSON",
        title: "Someone",
      },
    });
    await applySyncOperation(
      user.id,
      recallOp(memory.id, `${TAG}-del-event`),
    );

    await prisma.user.delete({ where: { id: user.id } });

    const remaining = await prisma.memoryRecallEvent.count({
      where: { clientEventId: `${TAG}-del-event` },
    });
    expect(remaining).toBe(0);
  });
});
