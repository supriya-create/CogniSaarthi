import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  caregiverLanguage,
  updateCaregiverPreference,
} from "@/lib/caregiver/preferences";

/**
 * A CAREGIVER'S LANGUAGE IS THEIR OWN.
 *
 * The elderly person cannot sign back in — they have no password — so
 * an interface that silently switched to a language they do not read
 * would not be an inconvenience, it would lock them out of their own
 * device until somebody noticed.
 *
 * The schema is what prevents it: the caregiver's language lives on
 * `CaregiverPreference`, the elder's on `UserPreference`, and no code
 * path joins them. These tests hold that apart against the real
 * database rather than trusting the two models to stay separate.
 */

const TAG = `lang-test-${Date.now()}`;

let elder = "";
let caregiverA = "";
let caregiverB = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: `${TAG}-elder`,
      connectCode: `${TAG}-e`,
      language: "AS",
      preference: { create: { language: "AS" } },
    },
  });
  elder = user.id;

  const a = await prisma.caregiver.create({
    data: {
      name: `${TAG}-a`,
      email: `${TAG}-a@example.test`,
      passwordHash: "not-a-real-hash",
    },
  });
  const b = await prisma.caregiver.create({
    data: {
      name: `${TAG}-b`,
      email: `${TAG}-b@example.test`,
      passwordHash: "not-a-real-hash",
    },
  });
  caregiverA = a.id;
  caregiverB = b.id;

  // Both caregivers look after the same elder.
  for (const caregiverId of [caregiverA, caregiverB]) {
    await prisma.caregiverLink.create({
      data: {
        caregiverId,
        userId: elder,
        relationship: "Daughter",
        status: "ACTIVE",
      },
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: elder } });
  await prisma.caregiver.deleteMany({
    where: { id: { in: [caregiverA, caregiverB] } },
  });
  await prisma.$disconnect();
});

describe("changing a caregiver's language", () => {
  it("does not change the elder's language", async () => {
    await updateCaregiverPreference(caregiverA, { language: "HI" });

    const user = await prisma.user.findUnique({
      where: { id: elder },
      include: { preference: true },
    });

    // The elder reads Assamese and still does.
    expect(user?.language).toBe("AS");
    expect(user?.preference?.language).toBe("AS");
  });

  it("does not change another caregiver's language", async () => {
    await updateCaregiverPreference(caregiverA, { language: "HI" });
    await updateCaregiverPreference(caregiverB, { language: "EN" });

    expect(await caregiverLanguage(caregiverA)).toBe("HI");
    expect(await caregiverLanguage(caregiverB)).toBe("EN");
  });

  it("keeps the caregiver's own choice", async () => {
    await updateCaregiverPreference(caregiverA, { language: "AS" });
    expect(await caregiverLanguage(caregiverA)).toBe("AS");
  });

  it("leaves notification preferences untouched", async () => {
    await updateCaregiverPreference(caregiverA, { weeklySummary: false });
    await updateCaregiverPreference(caregiverA, { language: "HI" });

    const prefs = await prisma.caregiverPreference.findUnique({
      where: { caregiverId: caregiverA },
    });
    // A language change is a language change, not a reset.
    expect(prefs?.weeklySummary).toBe(false);
    expect(prefs?.language).toBe("HI");
  });
});

describe("reading a caregiver's language", () => {
  it("defaults to English for a caregiver who has never chosen", async () => {
    const fresh = await prisma.caregiver.create({
      data: {
        name: `${TAG}-fresh`,
        email: `${TAG}-fresh@example.test`,
        passwordHash: "not-a-real-hash",
      },
    });

    expect(await caregiverLanguage(fresh.id)).toBe("EN");

    // Reading must not have written a row — rendering a page should
    // never be a database write.
    const created = await prisma.caregiverPreference.findUnique({
      where: { caregiverId: fresh.id },
    });
    expect(created).toBeNull();

    await prisma.caregiver.delete({ where: { id: fresh.id } });
  });

  it("never consults the elder's preference", async () => {
    // The elder reads Assamese; a caregiver who has chosen nothing
    // gets English, not the elder's language. If this ever returns AS,
    // the two records have been joined somewhere they should not be.
    await prisma.caregiverPreference.deleteMany({
      where: { caregiverId: caregiverB },
    });
    expect(await caregiverLanguage(caregiverB)).toBe("EN");
  });
});
