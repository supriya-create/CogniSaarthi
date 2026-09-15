import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { deleteAccount, planAccountDeletion } from "@/lib/privacy/data-deletion";

/**
 * DELETING AN ACCOUNT MUST TAKE THE FILES WITH IT.
 *
 * The database side of this is a cascade and looks after itself. The
 * disk side does not, and the failure mode is the dangerous one: the
 * cascade removes `MemoryAudio` along with its memory, so the database
 * looks completely clean while a recording of somebody's daughter
 * saying their name is still sitting under ./storage.
 *
 * That is exactly what happened when Memory Lane added recordings and
 * `deleteAccount` still only knew about photographs. This asserts both
 * kinds are gone, with real files on the real disk.
 */

const IMAGE_ROOT = path.join(process.cwd(), "storage", "memory-images");
const AUDIO_ROOT = path.join(process.cwd(), "storage", "memory-audio");

const TAG = `deletion-test-${Date.now()}`;
let userId = "";
let caregiverId = "";
let imageName = "";
let audioName = "";

async function writeFixtureFiles(): Promise<void> {
  await mkdir(IMAGE_ROOT, { recursive: true });
  await mkdir(AUDIO_ROOT, { recursive: true });
  imageName = `${TAG}-photo.png`;
  audioName = `${TAG}-voice.webm`;
  await writeFile(path.join(IMAGE_ROOT, imageName), Buffer.from([1, 2, 3]));
  await writeFile(path.join(AUDIO_ROOT, audioName), Buffer.from([4, 5, 6]));
}

beforeEach(async () => {
  await writeFixtureFiles();

  const caregiver = await prisma.caregiver.upsert({
    where: { email: `${TAG}@test.local` },
    create: {
      name: `${TAG}-cg`,
      email: `${TAG}@test.local`,
      passwordHash: "x",
    },
    update: {},
  });
  caregiverId = caregiver.id;

  const user = await prisma.user.create({
    data: {
      name: `${TAG}-user`,
      connectCode: `${TAG}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 40),
    },
  });
  userId = user.id;

  await prisma.caregiverLink.create({
    data: { caregiverId, userId, status: "ACTIVE" },
  });

  const memory = await prisma.personalMemory.create({
    data: {
      userId,
      caregiverId,
      category: "PERSON",
      title: "Meera",
      relationship: "Daughter",
      imagePath: imageName,
    },
  });

  await prisma.memoryAudio.create({
    data: {
      memoryId: memory.id,
      caregiverId,
      path: audioName,
      mimeType: "audio/webm",
      bytes: 3,
      durationMs: 2400,
    },
  });

  await prisma.memoryRecallEvent.create({
    data: {
      userId,
      memoryId: memory.id,
      clientEventId: `${TAG}-${Math.random().toString(36).slice(2)}`,
      outcome: "RECOGNISED",
      mode: "CHOICE",
      presentation: "PERSON_RECOGNITION",
      intervalStep: 2,
      occurredAt: new Date(),
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { name: `${TAG}-user` } });
  await prisma.caregiver.deleteMany({ where: { email: `${TAG}@test.local` } });
  await prisma.$disconnect();
});

describe("the deletion plan", () => {
  it("counts the recordings and the recall answers, not only the photos", async () => {
    const plan = await planAccountDeletion(userId);
    expect(plan?.counts.memories).toBe(1);
    expect(plan?.counts.memoryImages).toBe(1);
    // Both added by Memory Lane, and both invisible in the plan until
    // they were counted here.
    expect(plan?.counts.memoryRecordings).toBe(1);
    expect(plan?.counts.recallEvents).toBe(1);
  });
});

describe("deleting the account", () => {
  it("removes the photograph AND the voice recording from disk", async () => {
    expect(existsSync(path.join(IMAGE_ROOT, imageName))).toBe(true);
    expect(existsSync(path.join(AUDIO_ROOT, audioName))).toBe(true);

    const result = await deleteAccount(userId);

    expect(result.deleted).toBe(true);
    expect(result.imagesRemoved).toBe(1);
    expect(result.recordingsRemoved).toBe(1);
    expect(result.imagesFailed).toBe(0);
    expect(result.recordingsFailed).toBe(0);

    expect(existsSync(path.join(IMAGE_ROOT, imageName))).toBe(false);
    expect(existsSync(path.join(AUDIO_ROOT, audioName))).toBe(false);
  });

  it("removes every recall answer", async () => {
    await deleteAccount(userId);
    expect(
      await prisma.memoryRecallEvent.count({ where: { userId } }),
    ).toBe(0);
  });

  it("removes the audio row along with its memory", async () => {
    await deleteAccount(userId);
    // Scoped to THIS test's elder: the caregiver is shared across the
    // block, and the plan test above deliberately leaves its own
    // fixture standing.
    expect(
      await prisma.memoryAudio.count({ where: { memory: { userId } } }),
    ).toBe(0);
  });

  it("leaves the caregiver's own account standing", async () => {
    await deleteAccount(userId);
    // A caregiver is a separate person who may look after others.
    expect(
      await prisma.caregiver.count({ where: { id: caregiverId } }),
    ).toBe(1);
  });

  it("records what it removed, without recording what it was", async () => {
    await deleteAccount(userId);

    const audit = await prisma.auditEvent.findFirst({
      where: { userId, action: "ACCOUNT_DATA_DELETED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();

    const detail = JSON.stringify(audit!.detail);
    expect(detail).toContain("recordingsRemoved");
    // Counts only. An audit entry must never carry the content of the
    // thing it describes.
    expect(detail).not.toContain("Meera");
    expect(detail).not.toContain(audioName);
    expect(detail).not.toContain(imageName);
  });
});
