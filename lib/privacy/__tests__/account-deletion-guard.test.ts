import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { deleteAccount, planAccountDeletion } from "@/lib/privacy/data-deletion";
import { accountDeletionSchema } from "@/lib/validation/schemas";

/**
 * THE GUARDS AROUND AN IRREVERSIBLE ACTION.
 *
 * `deleteAccount` itself is covered by data-lifecycle.test.ts. What is
 * tested here is everything that stands between a stray request and
 * somebody's photographs — the confirmation contract the route
 * enforces, and the fact that planning a deletion does not perform one.
 */

const TAG = `del-guard-${Date.now()}`;

let caregiverId = "";

beforeAll(async () => {
  const caregiver = await prisma.caregiver.create({
    data: {
      name: `${TAG}-cg`,
      email: `${TAG}@example.test`,
      passwordHash: "not-a-real-hash",
    },
  });
  caregiverId = caregiver.id;
});

afterAll(async () => {
  await prisma.caregiver.deleteMany({ where: { id: caregiverId } });
  await prisma.$disconnect();
});

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: { name: `${TAG}-${suffix}`, connectCode: `${TAG}-${suffix}` },
  });
}

describe("the confirmation contract", () => {
  it("accepts only the exact confirmation phrase", () => {
    expect(
      accountDeletionSchema.safeParse({ confirm: "DELETE_MY_ACCOUNT" }).success,
    ).toBe(true);
  });

  it("refuses an empty body", () => {
    // A bare DELETE with no body must not destroy an account.
    expect(accountDeletionSchema.safeParse(null).success).toBe(false);
    expect(accountDeletionSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a near-miss", () => {
    for (const confirm of [
      "DELETE",
      "delete_my_account",
      "DELETE_MY_ACCOUNT ",
      "yes",
      true,
      1,
    ]) {
      expect(
        accountDeletionSchema.safeParse({ confirm }).success,
        `accepted ${String(confirm)}`,
      ).toBe(false);
    }
  });

  it("refuses extra fields, so nothing can ride along", () => {
    // `.strict()`: a body that also names a user id is rejected
    // outright rather than having the extra field quietly ignored.
    expect(
      accountDeletionSchema.safeParse({
        confirm: "DELETE_MY_ACCOUNT",
        userId: "someone-else",
      }).success,
    ).toBe(false);
  });

  it("has no field naming whose account to delete", () => {
    // Identity comes from the elder's session cookie alone, so a
    // caregiver on a shared tablet cannot delete the person they care
    // for — the capability is absent, not merely checked.
    expect(Object.keys(accountDeletionSchema.shape)).toEqual(["confirm"]);
  });
});

describe("planning a deletion", () => {
  it("removes nothing", async () => {
    const user = await makeUser("plan");
    await prisma.personalMemory.create({
      data: {
        userId: user.id,
        caregiverId,
        category: "PERSON",
        title: "Someone",
      },
    });

    const plan = await planAccountDeletion(user.id);
    expect(plan?.counts.memories).toBe(1);

    // Still there. Showing somebody what they would lose must not be
    // the act of losing it.
    const stillThere = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(stillThere).not.toBeNull();
    expect(
      await prisma.personalMemory.count({ where: { userId: user.id } }),
    ).toBe(1);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it("returns null for a user who does not exist", async () => {
    expect(await planAccountDeletion("no-such-user")).toBeNull();
  });

  it("says plainly what it does NOT remove", async () => {
    const user = await makeUser("retained");
    const plan = await planAccountDeletion(user.id);

    // The UI and the docs both rest on this list being honest.
    expect(plan?.retained.length).toBeGreaterThan(0);
    expect(plan?.retained.join(" ")).toMatch(/audit/i);
    expect(plan?.retained.join(" ")).toMatch(/caregiver/i);

    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("deleting", () => {
  it("reports not-deleted for a user who is already gone", async () => {
    const result = await deleteAccount("no-such-user");
    expect(result.deleted).toBe(false);
    expect(result.plan).toBeNull();
  });

  it("does not delete a caregiver who cared for them", async () => {
    const user = await makeUser("cg-survives");
    await prisma.caregiverLink.create({
      data: {
        caregiverId,
        userId: user.id,
        relationship: "Daughter",
        status: "ACTIVE",
      },
    });

    await deleteAccount(user.id);

    // The caregiver is a separate person with their own login, who may
    // care for others. Their ACCESS ends; their account does not.
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
    });
    expect(caregiver).not.toBeNull();
    expect(
      await prisma.caregiverLink.count({ where: { userId: user.id } }),
    ).toBe(0);
  });

  it("removes memory recall events with the account", async () => {
    // Added in Phase 8. A cascade that was forgotten here would leave
    // a record of whether somebody recognised their own daughter,
    // attached to an account that no longer exists.
    const user = await makeUser("recall");
    const memory = await prisma.personalMemory.create({
      data: {
        userId: user.id,
        caregiverId,
        category: "PERSON",
        title: "Someone",
      },
    });
    await prisma.memoryRecallEvent.create({
      data: {
        userId: user.id,
        memoryId: memory.id,
        clientEventId: `${TAG}-recall-event`,
        outcome: "RECOGNISED",
        mode: "CHOICE",
        occurredAt: new Date(),
      },
    });

    await deleteAccount(user.id);

    expect(
      await prisma.memoryRecallEvent.count({ where: { userId: user.id } }),
    ).toBe(0);
  });

  it("leaves the audit record that the deletion happened", async () => {
    const user = await makeUser("audited");
    await deleteAccount(user.id);

    // The record that a deletion occurred must survive the deletion.
    // It carries no content — only that an action took place.
    const audit = await prisma.auditEvent.findFirst({
      where: { userId: user.id, action: "ACCOUNT_DATA_DELETED" },
    });
    expect(audit).not.toBeNull();

    await prisma.auditEvent.deleteMany({ where: { userId: user.id } });
  });
});
