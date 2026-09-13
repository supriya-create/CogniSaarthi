import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  caregiverLinkedTo,
  getEnabledMemoryForUser,
  getMemoryForCaregiver,
} from "@/lib/memories/queries";

/**
 * SECURITY: a caregiver must never reach a memory that belongs to an
 * elder they are not linked to. This exercises the real query helpers
 * against the database with two separate family units.
 *
 * Everything created here is uniquely tagged and removed afterwards.
 */

const TAG = `authz-test-${Date.now()}`;
let userA = "";
let userB = "";
let caregiverA = "";
let caregiverB = "";
let memoryOfA = "";

beforeAll(async () => {
  const uA = await prisma.user.create({
    data: { name: `${TAG}-userA`, connectCode: `${TAG}-A` },
  });
  const uB = await prisma.user.create({
    data: { name: `${TAG}-userB`, connectCode: `${TAG}-B` },
  });
  const cA = await prisma.caregiver.create({
    data: {
      name: `${TAG}-cgA`,
      email: `${TAG}-a@test.local`,
      passwordHash: "x",
    },
  });
  const cB = await prisma.caregiver.create({
    data: {
      name: `${TAG}-cgB`,
      email: `${TAG}-b@test.local`,
      passwordHash: "x",
    },
  });

  await prisma.caregiverLink.create({
    data: { caregiverId: cA.id, userId: uA.id, status: "ACTIVE" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: cB.id, userId: uB.id, status: "ACTIVE" },
  });

  const memory = await prisma.personalMemory.create({
    data: {
      userId: uA.id,
      caregiverId: cA.id,
      category: "PERSON",
      title: "Test Person",
      enabled: true,
    },
  });

  userA = uA.id;
  userB = uB.id;
  caregiverA = cA.id;
  caregiverB = cB.id;
  memoryOfA = memory.id;
});

afterAll(async () => {
  // Cascades remove links and memories with their users/caregivers.
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.caregiver.deleteMany({
    where: { id: { in: [caregiverA, caregiverB] } },
  });
  await prisma.$disconnect();
});

describe("caregiverLinkedTo", () => {
  it("is true for a linked caregiver and false for an unlinked one", async () => {
    expect(await caregiverLinkedTo(caregiverA, userA)).toBe(true);
    expect(await caregiverLinkedTo(caregiverB, userA)).toBe(false);
  });
});

describe("getMemoryForCaregiver", () => {
  it("returns the memory for its owning caregiver", async () => {
    const memory = await getMemoryForCaregiver(memoryOfA, caregiverA);
    expect(memory?.id).toBe(memoryOfA);
  });

  it("returns null for a caregiver from another family", async () => {
    const memory = await getMemoryForCaregiver(memoryOfA, caregiverB);
    expect(memory).toBeNull();
  });

  it("returns null for a non-existent memory id", async () => {
    expect(await getMemoryForCaregiver("does-not-exist", caregiverA)).toBeNull();
  });
});

describe("getEnabledMemoryForUser", () => {
  it("returns a memory only to its own elder", async () => {
    expect((await getEnabledMemoryForUser(memoryOfA, userA))?.id).toBe(memoryOfA);
    expect(await getEnabledMemoryForUser(memoryOfA, userB)).toBeNull();
  });
});
