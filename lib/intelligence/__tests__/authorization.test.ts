import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { linkedUserFor, caregiverLinkedTo } from "@/lib/caregiver/access";
import { getIntelligenceSnapshot, getDailyPlan } from "@/lib/intelligence/server";

/**
 * USER H — the caregiver.
 *
 * SECURITY: a caregiver may see the intelligence for the elder they are
 * linked to, and no one else's. The endpoints take no user id at all —
 * identity is resolved from the session — so this exercises the
 * resolution those routes depend on, plus the underlying snapshot.
 */

const TAG = `intel-authz-${Date.now()}`;
const GAME_ID = "remember-objects";

let elderA = "";
let elderB = "";
let caregiverA = "";
let caregiverB = "";
let lonelyCaregiver = "";

beforeAll(async () => {
  await prisma.game.upsert({
    where: { id: GAME_ID },
    create: {
      id: GAME_ID,
      name: "Remember the Objects",
      domain: "SHORT_TERM_MEMORY",
      shortDescription: "t",
      instructions: "t",
      iconKey: "brain",
    },
    update: {},
  });

  const [uA, uB] = await Promise.all([
    prisma.user.create({ data: { name: `${TAG}-A`, connectCode: `${TAG}-A` } }),
    prisma.user.create({ data: { name: `${TAG}-B`, connectCode: `${TAG}-B` } }),
  ]);
  const [cA, cB, cL] = await Promise.all([
    prisma.caregiver.create({
      data: { name: `${TAG}-cA`, email: `${TAG}-a@t.local`, passwordHash: "x" },
    }),
    prisma.caregiver.create({
      data: { name: `${TAG}-cB`, email: `${TAG}-b@t.local`, passwordHash: "x" },
    }),
    prisma.caregiver.create({
      data: { name: `${TAG}-cL`, email: `${TAG}-l@t.local`, passwordHash: "x" },
    }),
  ]);

  elderA = uA.id;
  elderB = uB.id;
  caregiverA = cA.id;
  caregiverB = cB.id;
  lonelyCaregiver = cL.id;

  await prisma.caregiverLink.create({
    data: { caregiverId: caregiverA, userId: elderA, status: "ACTIVE" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: caregiverB, userId: elderB, status: "ACTIVE" },
  });

  // Give elder A some real history so there is something to protect.
  for (let i = 0; i < 4; i++) {
    const session = await prisma.gameSession.create({
      data: {
        userId: elderA,
        gameId: GAME_ID,
        difficulty: "MEDIUM",
        status: "COMPLETED",
        completedAt: new Date(Date.now() - i * 86_400_000),
        roundsTotal: 5,
        roundsCompleted: 5,
      },
      select: { id: true },
    });
    await prisma.gameResult.create({
      data: {
        sessionId: session.id,
        score: 80,
        accuracy: 0.8,
        stars: 4,
        correctCount: 4,
        incorrectCount: 1,
      },
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [elderA, elderB] } } });
  await prisma.caregiver.deleteMany({
    where: { id: { in: [caregiverA, caregiverB, lonelyCaregiver] } },
  });
  await prisma.$disconnect();
});

describe("caregiver → elder resolution", () => {
  it("resolves a linked caregiver to their own elder", async () => {
    expect((await linkedUserFor(caregiverA))?.id).toBe(elderA);
    expect((await linkedUserFor(caregiverB))?.id).toBe(elderB);
  });

  it("resolves an unlinked caregiver to nobody", async () => {
    expect(await linkedUserFor(lonelyCaregiver)).toBeNull();
  });

  it("never resolves a caregiver to another family's elder", async () => {
    const resolved = await linkedUserFor(caregiverA);
    expect(resolved?.id).not.toBe(elderB);
    expect(await caregiverLinkedTo(caregiverA, elderB)).toBe(false);
    expect(await caregiverLinkedTo(caregiverB, elderA)).toBe(false);
  });

  it("stops resolving once a link is revoked", async () => {
    const link = await prisma.caregiverLink.findFirst({
      where: { caregiverId: caregiverB, userId: elderB },
    });
    await prisma.caregiverLink.update({
      where: { id: link!.id },
      data: { status: "REVOKED" },
    });
    expect(await linkedUserFor(caregiverB)).toBeNull();
    expect(await caregiverLinkedTo(caregiverB, elderB)).toBe(false);

    await prisma.caregiverLink.update({
      where: { id: link!.id },
      data: { status: "ACTIVE" },
    });
  });
});

describe("intelligence is computed per elder", () => {
  it("builds a real snapshot for the elder with history", async () => {
    const snapshot = await getIntelligenceSnapshot(elderA);
    const memory = snapshot.profiles.find(
      (p) => p.domain === "SHORT_TERM_MEMORY",
    )!;
    expect(memory.activityCount).toBe(4);
    expect(memory.baseline.state).toBe("ESTABLISHED");
    expect(snapshot.routine.totalActivities).toBe(4);
  });

  it("does not leak one elder's activity into another's", async () => {
    const snapshot = await getIntelligenceSnapshot(elderB);
    expect(snapshot.routine.totalActivities).toBe(0);
    for (const profile of snapshot.profiles) {
      expect(profile.activityCount).toBe(0);
      expect(profile.baseline.state).toBe("NOT_ESTABLISHED");
      expect(profile.confidence).toBe("LOW");
    }
  });

  it("still produces a usable plan for an elder with no history", async () => {
    const plan = await getDailyPlan(elderB);
    expect(plan.activities.length).toBeGreaterThan(0);
    expect(plan.activities[0].primaryReason).toBe("coldStart");
  });
});
