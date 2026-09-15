import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  grantConsent,
  withdrawConsent,
} from "@/lib/privacy/server";
import { participantId } from "@/lib/privacy/pseudonymise";
import { containsForbiddenField } from "@/lib/research-data/export";
import {
  buildResearchExportForUser,
  buildResearchExport,
} from "@/lib/research-data/export-service";

/**
 * The export SERVICE, against the real database.
 *
 * Four properties, in order of how badly they would matter:
 *
 *   1. A person who has not consented produces nothing.
 *   2. Activity from after a withdrawal produces nothing.
 *   3. Personal memories and caregiver notes never appear, even when
 *      they exist and are full of sensitive text.
 *   4. No direct identifier survives — the id in the export cannot be
 *      the user's id, name, email or connect code.
 *
 * Everything created here is uniquely tagged and removed afterwards.
 */

const TAG = `export-test-${Date.now()}`;
const GAME_ID = "remember-objects";
/** Everything this file creates happens after this instant. */
const startedAt = new Date();

/** A: never consented. B: consented. C: consented then withdrew. */
let userA = "";
let userB = "";
let userC = "";
let caregiver = "";

const CONSENT_AT = new Date("2026-09-01T00:00:00.000Z");
const BEFORE_CONSENT = new Date("2026-08-20T09:00:00.000Z");
const INSIDE_WINDOW = new Date("2026-09-05T09:00:00.000Z");
const AFTER_WITHDRAWAL = new Date("2026-09-12T09:00:00.000Z");
const WITHDRAW_AT = new Date("2026-09-10T00:00:00.000Z");

async function completedSession(userId: string, at: Date, suffix: string) {
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

  return session.id;
}

beforeAll(async () => {
  const [a, b, c] = await Promise.all([
    prisma.user.create({
      data: { name: `${TAG}-A`, connectCode: `${TAG}-A`.slice(-16) },
    }),
    prisma.user.create({
      data: { name: `${TAG}-B`, connectCode: `${TAG}-B`.slice(-16) },
    }),
    prisma.user.create({
      data: { name: `${TAG}-C`, connectCode: `${TAG}-C`.slice(-16) },
    }),
  ]);
  userA = a.id;
  userB = b.id;
  userC = c.id;

  const cg = await prisma.caregiver.create({
    data: {
      name: `${TAG}-cg`,
      email: `${TAG}@test.local`,
      passwordHash: "x",
    },
  });
  caregiver = cg.id;
  await prisma.caregiverLink.create({
    data: { caregiverId: caregiver, userId: userB, status: "ACTIVE" },
  });

  // Every user plays. Only consent differs.
  await completedSession(userA, INSIDE_WINDOW, "a1");
  await completedSession(userB, BEFORE_CONSENT, "b-before");
  await completedSession(userB, INSIDE_WINDOW, "b-inside");
  await completedSession(userC, INSIDE_WINDOW, "c-inside");
  await completedSession(userC, AFTER_WITHDRAWAL, "c-after");

  // B has a memory with a photo and a private description, and a
  // caregiver note. None of it may reach an export.
  await prisma.personalMemory.create({
    data: {
      userId: userB,
      caregiverId: caregiver,
      category: "PERSON",
      title: "Ritu",
      relationship: "Daughter",
      description: "Visits every Sunday with the grandchildren",
      imagePath: `${TAG}-photo.jpg`,
      enabled: true,
    },
  });
  await prisma.caregiverNote.create({
    data: {
      userId: userB,
      caregiverId: caregiver,
      body: "Seemed tired this morning, ate very little.",
      category: "MOOD",
    },
  });
  await prisma.emergencyContact.create({
    data: { userId: userB, name: "Ritu", phone: "+919876543210" },
  });

  await grantConsent(userB, CONSENT_AT);
  await grantConsent(userC, CONSENT_AT);
  await withdrawConsent(userC, WITHDRAW_AT);
});

afterAll(async () => {
  const ids = [userA, userB, userC].filter(Boolean);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.caregiver.deleteMany({ where: { id: caregiver } });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: ids } } });
  // Cohort-export events carry no userId, so the clause above misses
  // them and they would pile up on every run. Removed by window rather
  // than by id, so a real deployment's history is never touched.
  await prisma.auditEvent.deleteMany({
    where: {
      action: "RESEARCH_EXPORT_GENERATED",
      userId: null,
      createdAt: { gte: startedAt },
    },
  });
});

describe("non-consented user", () => {
  it("exports nothing at all", async () => {
    const result = await buildResearchExportForUser(userA);
    expect(result.records).toHaveLength(0);
    expect(result.skippedReason).toBe("no_consent");
  });

  it("does not appear in the cohort export", async () => {
    const cohort = await buildResearchExport();
    const pid = participantId(userA);
    expect(
      cohort.records.some((r) => r.anonymousParticipantId === pid),
    ).toBe(false);
  });

  it("still has their activity in the product", async () => {
    // Refusing research use must not cost someone their own history.
    const count = await prisma.gameSession.count({ where: { userId: userA } });
    expect(count).toBe(1);
  });
});

describe("consented user", () => {
  it("exports the activity inside the consented window", async () => {
    const result = await buildResearchExportForUser(userB);
    expect(result.skippedReason).toBeNull();
    expect(result.records).toHaveLength(1);
  });

  it("excludes activity from BEFORE consent was given", async () => {
    const result = await buildResearchExportForUser(userB);
    expect(result.summary.outsideConsentWindow).toBe(1);
  });

  it("uses a pseudonymous id that is not the user id", async () => {
    const [record] = (await buildResearchExportForUser(userB)).records;
    expect(record.anonymousParticipantId).not.toBe(userB);
    expect(record.anonymousParticipantId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces the same id for the same person every time", async () => {
    const first = (await buildResearchExportForUser(userB)).records[0];
    const second = (await buildResearchExportForUser(userB)).records[0];
    expect(first.anonymousParticipantId).toBe(second.anonymousParticipantId);
  });

  it("produces a different id for a different person", async () => {
    expect(participantId(userB)).not.toBe(participantId(userC));
  });

  it("namespaces ids per purpose, so two exports cannot be joined", async () => {
    expect(participantId(userB, "purpose-one")).not.toBe(
      participantId(userB, "purpose-two"),
    );
  });

  it("carries no name, email, phone or connect code anywhere", async () => {
    const result = await buildResearchExportForUser(userB);
    const serialised = JSON.stringify(result.records);

    expect(serialised).not.toContain(userB);
    expect(serialised).not.toContain(`${TAG}-B`);
    expect(serialised).not.toContain("@test.local");
    expect(serialised).not.toContain("+919876543210");
  });

  it("carries no memory photo, title, relationship or description", async () => {
    const serialised = JSON.stringify(
      (await buildResearchExportForUser(userB)).records,
    );
    expect(serialised).not.toContain("Ritu");
    expect(serialised).not.toContain("Daughter");
    expect(serialised).not.toContain("grandchildren");
    expect(serialised).not.toContain(".jpg");
  });

  it("carries no caregiver note body or caregiver identifier", async () => {
    const serialised = JSON.stringify(
      (await buildResearchExportForUser(userB)).records,
    );
    expect(serialised).not.toContain("ate very little");
    expect(serialised).not.toContain(caregiver);
  });

  it("carries no forbidden field on any record", async () => {
    for (const record of (await buildResearchExportForUser(userB)).records) {
      expect(containsForbiddenField(record)).toBeNull();
    }
  });

  it("buckets the duration rather than exporting it exactly", async () => {
    const [record] = (await buildResearchExportForUser(userB)).records;
    expect(record.sessionDurationBucket).toBe("30-60s");
    expect(record).not.toHaveProperty("durationMs");
  });

  it("records which consent version the data was collected under", async () => {
    const [record] = (await buildResearchExportForUser(userB)).records;
    expect(record.consentVersion).toBe("research-consent-v1");
  });
});

describe("withdrawn consent", () => {
  it("exports nothing once consent is withdrawn", async () => {
    const result = await buildResearchExportForUser(userC);
    expect(result.records).toHaveLength(0);
    expect(result.skippedReason).toBe("consent_withdrawn");
  });

  it("excludes the withdrawn person from the cohort export", async () => {
    const cohort = await buildResearchExport();
    const pid = participantId(userC);
    expect(cohort.records.some((r) => r.anonymousParticipantId === pid)).toBe(
      false,
    );
  });

  it("leaves their ordinary product history untouched", async () => {
    const count = await prisma.gameSession.count({ where: { userId: userC } });
    expect(count).toBe(2);
  });
});

describe("cohort export", () => {
  it("includes the consenting user and excludes the others", async () => {
    const cohort = await buildResearchExport();
    const ours = cohort.records.filter(
      (r) => r.anonymousParticipantId === participantId(userB),
    );
    expect(ours).toHaveLength(1);
  });

  it("writes one audit event with counts only", async () => {
    await buildResearchExport();
    const event = await prisma.auditEvent.findFirst({
      where: { action: "RESEARCH_EXPORT_GENERATED" },
      orderBy: { createdAt: "desc" },
    });

    expect(event).not.toBeNull();
    expect(event?.userId).toBeNull();
    const detail = event?.detail as Record<string, unknown>;
    expect(typeof detail.participantCount).toBe("number");
    expect(typeof detail.recordCount).toBe("number");
    // Not a single row of the export itself.
    expect(detail).not.toHaveProperty("rows");
    expect(detail).not.toHaveProperty("records");
  });
});
