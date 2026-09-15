import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { buildCaregiverSnapshot } from "@/lib/caregiver/snapshot";
import {
  snapshotFreshness,
  stalenessMessage,
  SNAPSHOT_TTL_MS,
} from "@/lib/caregiver/snapshot-types";
import * as caregiverStore from "@/lib/offline/caregiver-store";
import { buildPersonalDataExport } from "@/lib/privacy/data-export";
import {
  getConsentStatus,
  grantConsent,
  withdrawConsent,
} from "@/lib/privacy/server";
import { buildResearchExportForUser } from "@/lib/research-data/export-service";

/**
 * SIMULATED USERS A–H.
 *
 * End-to-end privacy scenarios, each one a sentence somebody could say
 * about the product. Written as a single file so the whole story is
 * readable in one place, against the real database and a real
 * IndexedDB.
 */

const TAG = `sim-test-${Date.now()}`;
const GAME_ID = "remember-objects";

const CONSENT_AT = new Date("2026-09-01T00:00:00.000Z");
const WITHDRAW_AT = new Date("2026-09-10T00:00:00.000Z");
const BEFORE = new Date("2026-08-25T09:00:00.000Z");
const INSIDE = new Date("2026-09-05T09:00:00.000Z");
const AFTER = new Date("2026-09-12T09:00:00.000Z");

/** A: no consent. B: consented. C: withdrew. H: has a private memory. */
const users: Record<string, string> = {};
let caregiverA = "";
let caregiverB = "";
let elderA = "";
let elderB = "";

async function makeUser(key: string) {
  const user = await prisma.user.create({
    data: {
      name: `${TAG}-${key}`,
      connectCode: `${TAG}-${key}`.slice(-16),
      preference: { create: { timeZone: "Asia/Kolkata" } },
    },
  });
  users[key] = user.id;
  return user.id;
}

async function play(userId: string, at: Date, suffix: string) {
  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameId: GAME_ID,
      difficulty: "EASY",
      status: "COMPLETED",
      startedAt: at,
      completedAt: at,
      durationMs: 45_000,
      roundsTotal: 4,
      roundsCompleted: 4,
      clientSessionId: `${TAG}-${suffix}`,
    },
  });
  await prisma.gameResult.create({
    data: {
      sessionId: session.id,
      score: 75,
      accuracy: 0.75,
      stars: 3,
      correctCount: 3,
      incorrectCount: 1,
      mistakes: 1,
      hints: 0,
      totalResponseTimeMs: 9000,
      avgResponseTimeMs: 2250,
    },
  });
}

beforeAll(async () => {
  await makeUser("A");
  await makeUser("B");
  await makeUser("C");
  await makeUser("H");

  elderA = await makeUser("elderA");
  elderB = await makeUser("elderB");

  const [cA, cB] = await Promise.all([
    prisma.caregiver.create({
      data: { name: `${TAG}-cgA`, email: `${TAG}-a@test.local`, passwordHash: "x" },
    }),
    prisma.caregiver.create({
      data: { name: `${TAG}-cgB`, email: `${TAG}-b@test.local`, passwordHash: "x" },
    }),
  ]);
  caregiverA = cA.id;
  caregiverB = cB.id;

  await prisma.caregiverLink.create({
    data: { caregiverId: caregiverA, userId: elderA, status: "ACTIVE" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: caregiverB, userId: elderB, status: "ACTIVE" },
  });

  await play(users.A, INSIDE, "a1");
  await play(users.B, BEFORE, "b0");
  await play(users.B, INSIDE, "b1");
  await play(users.C, INSIDE, "c1");
  await play(users.C, AFTER, "c2");
  await play(users.H, INSIDE, "h1");
  await play(elderA, INSIDE, "ea1");

  // User H's private memory — the most sensitive thing in the product.
  await prisma.personalMemory.create({
    data: {
      userId: users.H,
      caregiverId: caregiverA,
      category: "PERSON",
      title: "Bhaskar",
      relationship: "Husband",
      description: "Our wedding day in Guwahati",
      imagePath: `${TAG}-wedding.jpg`,
    },
  });

  await grantConsent(users.B, CONSENT_AT);
  await grantConsent(users.C, CONSENT_AT);
  await withdrawConsent(users.C, WITHDRAW_AT);
  await grantConsent(users.H, CONSENT_AT);
});

afterAll(async () => {
  const ids = Object.values(users);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.caregiver.deleteMany({
    where: { id: { in: [caregiverA, caregiverB] } },
  });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: ids } } });
});

describe("User A — no research consent", () => {
  it("the product works normally", async () => {
    const own = await buildPersonalDataExport(users.A);
    expect(own?.activities).toHaveLength(1);
  });

  it("there is no research export", async () => {
    const result = await buildResearchExportForUser(users.A);
    expect(result.records).toHaveLength(0);
    expect(result.skippedReason).toBe("no_consent");
  });

  it("their status invites a decision rather than assuming one", async () => {
    const status = await getConsentStatus(users.A);
    expect(status.state).toBe("NOT_ASKED");
    expect(status.needsDecision).toBe(true);
  });
});

describe("User B — research consent granted", () => {
  it("has an eligible research representation", async () => {
    const result = await buildResearchExportForUser(users.B);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.skippedReason).toBeNull();
  });

  it("the export contains no PII", async () => {
    const serialised = JSON.stringify(
      (await buildResearchExportForUser(users.B)).records,
    );
    expect(serialised).not.toContain(users.B);
    expect(serialised).not.toContain(`${TAG}-B`);
    expect(serialised).not.toContain("@test.local");
  });
});

describe("User C — consent withdrawn", () => {
  it("future activity is excluded from research export", async () => {
    const result = await buildResearchExportForUser(users.C);
    expect(result.records).toHaveLength(0);
    expect(result.skippedReason).toBe("consent_withdrawn");
  });

  it("the product continues working", async () => {
    const own = await buildPersonalDataExport(users.C);
    expect(own?.activities).toHaveLength(2);
    expect(own?.researchConsent.state).toBe("WITHDRAWN");
  });

  it("they are not silently re-consented", async () => {
    expect((await getConsentStatus(users.C)).researchEligible).toBe(false);
    expect((await getConsentStatus(users.C)).needsDecision).toBe(false);
  });
});

describe("User D — Caregiver A linked to Elder A", () => {
  it("sees Elder A's snapshot", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    expect(snapshot?.elderId).toBe(elderA);
    expect(snapshot?.data.recentSessions.length).toBeGreaterThan(0);
  });
});

describe("User E — Caregiver A attempts Elder B", () => {
  it("access is denied: there is no parameter to forge", async () => {
    // The builder takes a caregiver id only; the elder comes from the
    // caregiver's own ACTIVE link. A cannot name B.
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    expect(snapshot?.elderId).not.toBe(elderB);
  });

  it("a snapshot response for another caregiver is rejected locally", async () => {
    const foreign = await buildCaregiverSnapshot(caregiverB);
    // Simulate a response that arrived carrying somebody else's id.
    await caregiverStore.clearCaregiverSnapshots();
    await caregiverStore.saveCaregiverSnapshot(foreign!);
    expect(await caregiverStore.getCaregiverSnapshot(caregiverA)).toBeNull();
  });
});

describe("User F — caregiver offline", () => {
  it("gets a read-only snapshot that is labelled as saved earlier", async () => {
    const generatedAt = new Date(Date.now() - 20 * 60 * 1000);
    const snapshot = await buildCaregiverSnapshot(caregiverA, generatedAt);

    await caregiverStore.clearCaregiverSnapshots();
    await caregiverStore.saveCaregiverSnapshot(snapshot!);

    const result = await caregiverStore.readSnapshotWithFreshness(caregiverA);
    expect(result).not.toBeNull();
    expect(result?.freshness).toBe("STALE");

    const message = stalenessMessage(
      result!.freshness,
      result!.snapshot.generatedAt,
    );
    expect(message).toContain("saved earlier");
    expect(message).toContain("20 minutes ago");
  });

  it("an old snapshot is shown as possibly out of date", async () => {
    const generatedAt = new Date(Date.now() - 2 * SNAPSHOT_TTL_MS);
    const snapshot = await buildCaregiverSnapshot(caregiverA, generatedAt);

    await caregiverStore.clearCaregiverSnapshots();
    await caregiverStore.saveCaregiverSnapshot(snapshot!);

    const result = await caregiverStore.readSnapshotWithFreshness(caregiverA);
    expect(snapshotFreshness(result!.snapshot)).toBe("EXPIRED");
    expect(
      stalenessMessage(result!.freshness, result!.snapshot.generatedAt),
    ).toContain("may be out of date");
  });
});

describe("User G — caregiver signs out", () => {
  it("the snapshot is removed from the device", async () => {
    const snapshot = await buildCaregiverSnapshot(caregiverA);
    await caregiverStore.saveCaregiverSnapshot(snapshot!);
    expect(await caregiverStore.getCaregiverSnapshot(caregiverA)).not.toBeNull();

    await caregiverStore.clearCaregiverSnapshots();
    expect(await caregiverStore.getCaregiverSnapshot(caregiverA)).toBeNull();
  });
});

describe("User H — a private memory exists", () => {
  it("the research export contains no memory photo or content", async () => {
    const serialised = JSON.stringify(
      (await buildResearchExportForUser(users.H)).records,
    );
    expect(serialised).not.toContain("Bhaskar");
    expect(serialised).not.toContain("Husband");
    expect(serialised).not.toContain("Guwahati");
    expect(serialised).not.toContain("wedding.jpg");
  });

  it("but the memory is still there for them, in the product", async () => {
    // Excluding it from research must not mean losing it.
    const own = await buildPersonalDataExport(users.H);
    expect(own?.memories).toHaveLength(1);
    expect(own?.memories[0].title).toBe("Bhaskar");
    expect(own?.memories[0].hasPhoto).toBe(true);
  });

  it("their own export names the photo without inlining its bytes", async () => {
    const own = await buildPersonalDataExport(users.H);
    expect(JSON.stringify(own)).not.toContain("wedding.jpg");
    expect(own?.memories[0].hasPhoto).toBe(true);
  });
});
