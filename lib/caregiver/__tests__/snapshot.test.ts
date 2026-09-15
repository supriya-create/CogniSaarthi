import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { buildCaregiverSnapshot } from "@/lib/caregiver/snapshot";
import { CAREGIVER_SNAPSHOT_VERSION } from "@/lib/caregiver/snapshot-types";

/**
 * SECURITY: the caregiver snapshot.
 *
 * Two family units, deliberately. Caregiver A is linked to Elder A and
 * Caregiver B to Elder B, and the test asserts that there is no way to
 * get A's snapshot to describe B — because the builder takes only a
 * caregiver id and resolves the elder itself.
 *
 * Also asserted: the snapshot carries none of the things §21 says it
 * must not, even though all of them exist in the database for Elder A.
 */

const TAG = `cgsnap-test-${Date.now()}`;
const GAME_ID = "remember-objects";

let userA = "";
let userB = "";
let caregiverA = "";
let caregiverB = "";
let caregiverUnlinked = "";

beforeAll(async () => {
  const [uA, uB] = await Promise.all([
    prisma.user.create({
      data: {
        name: `${TAG}-elderA`,
        connectCode: `${TAG}-A`.slice(-16),
        preference: { create: { timeZone: "Asia/Kolkata" } },
      },
    }),
    prisma.user.create({
      data: {
        name: `${TAG}-elderB`,
        connectCode: `${TAG}-B`.slice(-16),
        preference: { create: { timeZone: "Asia/Kolkata" } },
      },
    }),
  ]);
  userA = uA.id;
  userB = uB.id;

  const [cA, cB, cU] = await Promise.all([
    prisma.caregiver.create({
      data: { name: `${TAG}-cgA`, email: `${TAG}-a@test.local`, passwordHash: "x" },
    }),
    prisma.caregiver.create({
      data: { name: `${TAG}-cgB`, email: `${TAG}-b@test.local`, passwordHash: "x" },
    }),
    prisma.caregiver.create({
      data: { name: `${TAG}-cgU`, email: `${TAG}-u@test.local`, passwordHash: "x" },
    }),
  ]);
  caregiverA = cA.id;
  caregiverB = cB.id;
  caregiverUnlinked = cU.id;

  await prisma.caregiverLink.create({
    data: {
      caregiverId: caregiverA,
      userId: userA,
      status: "ACTIVE",
      relationship: "Daughter",
    },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: caregiverB, userId: userB, status: "ACTIVE" },
  });

  // Elder A has everything sensitive the snapshot must leave behind.
  await prisma.personalMemory.create({
    data: {
      userId: userA,
      caregiverId: caregiverA,
      category: "PERSON",
      title: "Ritu",
      relationship: "Daughter",
      description: "Visits every Sunday",
      imagePath: `${TAG}-photo.jpg`,
    },
  });
  await prisma.caregiverNote.create({
    data: {
      userId: userA,
      caregiverId: caregiverA,
      body: "Ate very little at lunch.",
      category: "APPETITE",
    },
  });
  await prisma.emergencyContact.create({
    data: { userId: userA, name: "Ritu Sharma", phone: "+919876543210" },
  });
  await prisma.reminder.create({
    data: {
      userId: userA,
      caregiverId: caregiverA,
      // A title that names a medication is exactly why titles are not
      // carried into the snapshot.
      title: "Metformin 500mg",
      category: "MEDICATION",
      timeMinutes: 8 * 60,
      recurrence: "DAILY",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
    },
  });

  const session = await prisma.gameSession.create({
    data: {
      userId: userA,
      gameId: GAME_ID,
      difficulty: "EASY",
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 45_000,
      roundsTotal: 4,
      roundsCompleted: 4,
      clientSessionId: `${TAG}-s1`,
    },
  });
  await prisma.gameResult.create({
    data: {
      sessionId: session.id,
      score: 80,
      accuracy: 0.8,
      stars: 4,
      correctCount: 4,
      incorrectCount: 1,
      mistakes: 1,
      hints: 0,
      totalResponseTimeMs: 8000,
      avgResponseTimeMs: 2000,
    },
  });
});

afterAll(async () => {
  const users = [userA, userB].filter(Boolean);
  const caregivers = [caregiverA, caregiverB, caregiverUnlinked].filter(Boolean);
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.caregiver.deleteMany({ where: { id: { in: caregivers } } });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: users } } });
});

describe("authorized caregiver", () => {
  it("gets a snapshot of the elder they are linked to", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.elderId).toBe(userA);
    expect(snapshot?.data.elder.name).toBe(`${TAG}-elderA`);
  });

  it("carries the relationship from the link", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    expect(snapshot?.data.elder.relationship).toBe("Daughter");
  });

  it("stamps the version, the generation time and an expiry", async () => {
    const now = new Date("2026-09-15T10:00:00.000Z");
    const snapshot = await buildCaregiverSnapshot(caregiverA, now);
    expect(snapshot?.snapshotVersion).toBe(CAREGIVER_SNAPSHOT_VERSION);
    expect(snapshot?.generatedAt).toBe(now.toISOString());
    expect(new Date(snapshot!.expiresAt).getTime()).toBeGreaterThan(
      now.getTime(),
    );
  });

  it("includes recent activity", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    expect(snapshot?.data.recentSessions.length).toBeGreaterThan(0);
    expect(snapshot?.data.recentSessions[0].score).toBe(80);
  });
});

describe("unauthorized caregiver", () => {
  it("cannot reach an elder they are not linked to", async () => {
    // There is no parameter to forge — the elder is resolved from the
    // caregiver's own link, so B's snapshot describes B's elder only.
    const snapshot = await buildCaregiverSnapshot(caregiverB);
    expect(snapshot?.elderId).toBe(userB);
    expect(snapshot?.elderId).not.toBe(userA);
  });

  it("gets nothing when they have no link at all", async () => {
    expect(await buildCaregiverSnapshot(caregiverUnlinked)).toBeNull();
  });

  it("gets nothing for a caregiver id that does not exist", async () => {
    expect(await buildCaregiverSnapshot("cg-does-not-exist")).toBeNull();
  });

  it("stops describing an elder once the link is revoked", async () => {
    const link = await prisma.caregiverLink.findFirst({
      where: { caregiverId: caregiverB, userId: userB },
    });
    await prisma.caregiverLink.update({
      where: { id: link!.id },
      data: { status: "REVOKED" },
    });

    expect(await buildCaregiverSnapshot(caregiverB)).toBeNull();

    await prisma.caregiverLink.update({
      where: { id: link!.id },
      data: { status: "ACTIVE" },
    });
  });
});

describe("what the snapshot does NOT carry", () => {
  it("carries no memory photo, title or description", async () => {
    const serialised = JSON.stringify(await buildCaregiverSnapshot(caregiverA));
    expect(serialised).not.toContain("photo.jpg");
    expect(serialised).not.toContain("Visits every Sunday");
  });

  it("carries no caregiver note body", async () => {
    const serialised = JSON.stringify(await buildCaregiverSnapshot(caregiverA));
    expect(serialised).not.toContain("Ate very little");
  });

  it("carries no emergency contact name or phone number", async () => {
    const serialised = JSON.stringify(await buildCaregiverSnapshot(caregiverA));
    expect(serialised).not.toContain("Ritu Sharma");
    expect(serialised).not.toContain("+919876543210");
  });

  it("carries no reminder title, so a medication is never named", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain("Metformin");

    // The status itself IS carried — category, time and state.
    expect(snapshot?.data.reminders.length).toBeGreaterThan(0);
    expect(snapshot?.data.reminders[0]).toHaveProperty("category");
    expect(snapshot?.data.reminders[0]).not.toHaveProperty("title");
  });

  it("carries no elder connect code", async () => {
    const user = await prisma.user.findUnique({ where: { id: userA } });
    const serialised = JSON.stringify(await buildCaregiverSnapshot(caregiverA));
    expect(serialised).not.toContain(user!.connectCode);
  });

  it("carries no caregiver email or password hash", async () => {
    const serialised = JSON.stringify(await buildCaregiverSnapshot(caregiverA));
    expect(serialised).not.toContain("@test.local");
    expect(serialised).not.toContain("passwordHash");
  });
});

describe("audit", () => {
  it("records that a snapshot was issued, with counts only", async () => {
    await buildCaregiverSnapshot(caregiverA);
    const event = await prisma.auditEvent.findFirst({
      where: { action: "CAREGIVER_SNAPSHOT_ISSUED", userId: userA },
      orderBy: { createdAt: "desc" },
    });

    expect(event).not.toBeNull();
    expect(event?.caregiverId).toBe(caregiverA);
    const detail = event?.detail as Record<string, unknown>;
    expect(typeof detail.sessionCount).toBe("number");
    expect(detail).not.toHaveProperty("name");
  });
});
