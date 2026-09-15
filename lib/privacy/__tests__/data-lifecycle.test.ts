import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import { buildPersonalDataExport } from "@/lib/privacy/data-export";
import { deleteAccount, planAccountDeletion } from "@/lib/privacy/data-deletion";

/**
 * A person's own data: getting a copy of it, and getting rid of it.
 *
 * The test that matters most is the last group. A cascade delete LOOKS
 * complete and leaves the family photographs on disk, so the deletion
 * service is verified against the filesystem, not just the database.
 */

const TAG = `lifecycle-${Date.now()}`;
const STORAGE_ROOT = path.join(process.cwd(), "storage", "memory-images");
const created: string[] = [];
let caregiverId = "";

async function fileExists(name: string): Promise<boolean> {
  try {
    await access(path.join(STORAGE_ROOT, name));
    return true;
  } catch {
    return false;
  }
}

async function makeUser(key: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `${TAG}-${key}`,
      connectCode: `${TAG}-${key}`.slice(-16),
      preference: { create: {} },
    },
  });
  created.push(user.id);
  return user.id;
}

/** A user with one of everything, plus a real file on disk. */
async function populate(userId: string, imageName: string) {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(path.join(STORAGE_ROOT, imageName), "not-really-a-jpeg");

  await prisma.personalMemory.create({
    data: {
      userId,
      caregiverId,
      category: "PERSON",
      title: "Bhaskar",
      relationship: "Husband",
      description: "Our wedding day",
      imagePath: imageName,
    },
  });

  const reminder = await prisma.reminder.create({
    data: {
      userId,
      caregiverId,
      title: "Morning walk",
      category: "DAILY_ROUTINE",
      timeMinutes: 420,
      recurrence: "DAILY",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
    },
  });
  await prisma.reminderLog.create({
    data: {
      reminderId: reminder.id,
      userId,
      scheduledFor: new Date("2026-09-02T01:30:00.000Z"),
      status: "DONE",
    },
  });

  await prisma.caregiverNote.create({
    data: { userId, caregiverId, body: "Good spirits today.", category: "MOOD" },
  });
  await prisma.emergencyContact.create({
    data: { userId, name: "Ritu", phone: "+919876543210" },
  });

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameId: "remember-objects",
      difficulty: "EASY",
      status: "COMPLETED",
      startedAt: new Date("2026-09-05T09:00:00.000Z"),
      completedAt: new Date("2026-09-05T09:01:00.000Z"),
      durationMs: 45_000,
      roundsTotal: 4,
      roundsCompleted: 4,
      clientSessionId: `${TAG}-${userId}`,
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
  const caregiver = await prisma.caregiver.create({
    data: { name: `${TAG}-cg`, email: `${TAG}@test.local`, passwordHash: "x" },
  });
  caregiverId = caregiver.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.caregiver.deleteMany({ where: { id: caregiverId } });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: created } } });
});

describe("personal data export", () => {
  it("returns the person's own data in full", async () => {
    const userId = await makeUser("export");
    await populate(userId, `${TAG}-export.jpg`);

    const exported = await buildPersonalDataExport(userId);
    expect(exported?.profile.name).toBe(`${TAG}-export`);
    expect(exported?.activities).toHaveLength(1);
    expect(exported?.memories).toHaveLength(1);
    expect(exported?.reminders).toHaveLength(1);
    expect(exported?.caregiverNotes).toHaveLength(1);
    expect(exported?.emergencyContacts).toHaveLength(1);
  });

  it("names the photo without inlining its bytes", async () => {
    const userId = await makeUser("export2");
    await populate(userId, `${TAG}-export2.jpg`);

    const exported = await buildPersonalDataExport(userId);
    expect(exported?.memories[0].hasPhoto).toBe(true);
    expect(JSON.stringify(exported)).not.toContain("export2.jpg");
  });

  it("excludes the caregiver's email and password hash", async () => {
    const userId = await makeUser("export3");
    await populate(userId, `${TAG}-export3.jpg`);
    await prisma.caregiverLink.create({
      data: { caregiverId, userId, status: "ACTIVE" },
    });

    const serialised = JSON.stringify(await buildPersonalDataExport(userId));
    // The elder is entitled to know WHO can see their activity…
    expect(serialised).toContain(`${TAG}-cg`);
    // …but not to a copy of that person's credentials.
    expect(serialised).not.toContain("@test.local");
    expect(serialised).not.toContain("passwordHash");
  });

  it("returns null for a user that does not exist", async () => {
    expect(await buildPersonalDataExport("no-such-user")).toBeNull();
  });
});

describe("deletion plan", () => {
  it("counts everything that would be removed, without removing it", async () => {
    const userId = await makeUser("plan");
    await populate(userId, `${TAG}-plan.jpg`);

    const plan = await planAccountDeletion(userId);
    expect(plan?.counts.sessions).toBe(1);
    expect(plan?.counts.memories).toBe(1);
    expect(plan?.counts.memoryImages).toBe(1);
    expect(plan?.counts.reminders).toBe(1);
    expect(plan?.counts.reminderLogs).toBe(1);
    expect(plan?.counts.notes).toBe(1);
    expect(plan?.counts.emergencyContacts).toBe(1);

    // Nothing was actually deleted.
    expect(await prisma.gameSession.count({ where: { userId } })).toBe(1);
    expect(await fileExists(`${TAG}-plan.jpg`)).toBe(true);
  });

  it("states plainly what deletion does NOT remove", async () => {
    const userId = await makeUser("plan2");
    const plan = await planAccountDeletion(userId);
    expect(plan?.retained.length).toBeGreaterThanOrEqual(3);
    expect(plan?.retained.join(" ")).toContain("Audit events");
    expect(plan?.retained.join(" ")).toContain("Caregiver accounts");
  });

  it("returns null for a user that does not exist", async () => {
    expect(await planAccountDeletion("no-such-user")).toBeNull();
  });
});

describe("account deletion", () => {
  it("removes every row belonging to the person", async () => {
    const userId = await makeUser("delete");
    await populate(userId, `${TAG}-delete.jpg`);

    const result = await deleteAccount(userId);
    expect(result.deleted).toBe(true);

    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.gameSession.count({ where: { userId } })).toBe(0);
    expect(await prisma.personalMemory.count({ where: { userId } })).toBe(0);
    expect(await prisma.reminder.count({ where: { userId } })).toBe(0);
    expect(await prisma.reminderLog.count({ where: { userId } })).toBe(0);
    expect(await prisma.caregiverNote.count({ where: { userId } })).toBe(0);
    expect(await prisma.emergencyContact.count({ where: { userId } })).toBe(0);
  });

  it("REMOVES THE PHOTO FILE, which a cascade would have orphaned", async () => {
    const image = `${TAG}-photo-removal.jpg`;
    const userId = await makeUser("photo");
    await populate(userId, image);
    expect(await fileExists(image)).toBe(true);

    const result = await deleteAccount(userId);
    expect(result.imagesRemoved).toBe(1);
    expect(result.imagesFailed).toBe(0);
    expect(await fileExists(image)).toBe(false);
  });

  it("does not delete the caregiver, who is a different person", async () => {
    const userId = await makeUser("keeps-cg");
    await populate(userId, `${TAG}-keeps-cg.jpg`);
    await prisma.caregiverLink.create({
      data: { caregiverId, userId, status: "ACTIVE" },
    });

    await deleteAccount(userId);

    expect(await prisma.caregiver.count({ where: { id: caregiverId } })).toBe(1);
    // Their access, though, is gone with the link.
    expect(await prisma.caregiverLink.count({ where: { userId } })).toBe(0);
  });

  it("leaves an audit trail that survives the deletion", async () => {
    const userId = await makeUser("audit-survives");
    await populate(userId, `${TAG}-audit.jpg`);
    await deleteAccount(userId);

    const events = await prisma.auditEvent.findMany({ where: { userId } });
    expect(events.some((e) => e.action === "ACCOUNT_DATA_DELETED")).toBe(true);

    const detail = events.find((e) => e.action === "ACCOUNT_DATA_DELETED")
      ?.detail as Record<string, unknown>;
    // Counts only — no name, no memory title, no note body.
    expect(detail.sessionCount).toBe(1);
    expect(detail).not.toHaveProperty("name");
    expect(JSON.stringify(detail)).not.toContain("Bhaskar");
  });

  it("reports honestly when there is nothing to delete", async () => {
    const result = await deleteAccount("no-such-user");
    expect(result.deleted).toBe(false);
    expect(result.plan).toBeNull();
  });
});
