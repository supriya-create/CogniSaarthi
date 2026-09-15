import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { CURRENT_CONSENT_VERSION } from "@/lib/privacy/consent";
import {
  consentWindow,
  declineConsent,
  getConsentStatus,
  grantConsent,
  researchEligible,
  withdrawConsent,
} from "@/lib/privacy/server";
import { researchConsentSchema } from "@/lib/validation/schemas";

/**
 * Consent, persisted. Complements the pure rule tests next door.
 */

const TAG = `consent-db-${Date.now()}`;
const created: string[] = [];

async function freshUser(key: string): Promise<string> {
  const user = await prisma.user.create({
    data: { name: `${TAG}-${key}`, connectCode: `${TAG}-${key}`.slice(-16) },
  });
  created.push(user.id);
  return user.id;
}

beforeAll(async () => {
  // Each test makes its own user, so consent state cannot leak between
  // them. This one just proves the fixture works before the rest run.
  await freshUser("main");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: created } } });
});

describe("persistence", () => {
  it("starts with no record and no eligibility", async () => {
    const id = await freshUser("p1");
    expect((await getConsentStatus(id)).state).toBe("NOT_ASKED");
    expect(await researchEligible(id)).toBe(false);
  });

  it("persists a grant across reads", async () => {
    const id = await freshUser("p2");
    await grantConsent(id);
    expect((await getConsentStatus(id)).state).toBe("GRANTED");
    expect(await researchEligible(id)).toBe(true);
  });

  it("persists a decline as a real answer, not as silence", async () => {
    const id = await freshUser("p3");
    await declineConsent(id);

    const status = await getConsentStatus(id);
    expect(status.state).toBe("DECLINED");
    // Recorded, so the question is not asked again on every visit.
    expect(status.needsDecision).toBe(false);

    const rows = await prisma.researchConsent.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
  });

  it("stores exactly one row per version however many times it is answered", async () => {
    const id = await freshUser("p4");
    await grantConsent(id);
    await grantConsent(id);
    await declineConsent(id);
    await grantConsent(id);

    const rows = await prisma.researchConsent.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(CURRENT_CONSENT_VERSION);
  });

  it("records the purpose it was given for", async () => {
    const id = await freshUser("p5");
    await grantConsent(id);
    const row = await prisma.researchConsent.findFirst({ where: { userId: id } });
    expect(row?.purpose).toBe("RESEARCH_IMPROVEMENT");
  });
});

describe("withdrawal", () => {
  it("ends eligibility", async () => {
    const id = await freshUser("w1");
    await grantConsent(id);
    await withdrawConsent(id);

    expect(await researchEligible(id)).toBe(false);
    expect((await getConsentStatus(id)).state).toBe("WITHDRAWN");
  });

  it("keeps the row rather than deleting the history of the decision", async () => {
    const id = await freshUser("w2");
    await grantConsent(id);
    await withdrawConsent(id);

    const row = await prisma.researchConsent.findFirst({ where: { userId: id } });
    expect(row).not.toBeNull();
    expect(row?.withdrawnAt).not.toBeNull();
    expect(row?.consentedAt).not.toBeNull();
  });

  it("is a no-op when nothing was granted", async () => {
    const id = await freshUser("w3");
    await withdrawConsent(id);
    expect((await getConsentStatus(id)).state).toBe("NOT_ASKED");
    expect(
      await prisma.researchConsent.count({ where: { userId: id } }),
    ).toBe(0);
  });

  it("does not silently re-consent on a later read", async () => {
    const id = await freshUser("w4");
    await grantConsent(id);
    await withdrawConsent(id);

    for (let i = 0; i < 3; i++) {
      expect(await researchEligible(id)).toBe(false);
    }
  });

  it("requires an explicit new grant to become eligible again", async () => {
    const id = await freshUser("w5");
    await grantConsent(id);
    await withdrawConsent(id);
    expect(await researchEligible(id)).toBe(false);

    await grantConsent(id);
    expect(await researchEligible(id)).toBe(true);

    const row = await prisma.researchConsent.findFirst({ where: { userId: id } });
    expect(row?.withdrawnAt).toBeNull();
  });

  it("leaves ordinary product data completely alone", async () => {
    const id = await freshUser("w6");
    await prisma.reminder.create({
      data: {
        userId: id,
        title: "Morning walk",
        category: "DAILY_ROUTINE",
        timeMinutes: 420,
        recurrence: "DAILY",
        startDate: new Date(),
      },
    });

    await grantConsent(id);
    await withdrawConsent(id);

    expect(await prisma.reminder.count({ where: { userId: id } })).toBe(1);
  });
});

describe("the consented window", () => {
  it("reports when consent began", async () => {
    const id = await freshUser("cw1");
    const at = new Date("2026-09-01T00:00:00.000Z");
    await grantConsent(id, at);

    const window = await consentWindow(id);
    expect(window.consentedAt).toEqual(at);
    expect(window.withdrawnAt).toBeNull();
  });

  it("reports when it ended", async () => {
    const id = await freshUser("cw2");
    const granted = new Date("2026-09-01T00:00:00.000Z");
    const withdrawn = new Date("2026-09-10T00:00:00.000Z");
    await grantConsent(id, granted);
    await withdrawConsent(id, withdrawn);

    const window = await consentWindow(id);
    expect(window.consentedAt).toEqual(granted);
    expect(window.withdrawnAt).toEqual(withdrawn);
  });

  it("is empty for someone who never answered", async () => {
    const id = await freshUser("cw3");
    expect(await consentWindow(id)).toEqual({
      consentedAt: null,
      withdrawnAt: null,
    });
  });
});

describe("a caregiver cannot consent on an elder's behalf", () => {
  it("the request schema has no field to name another user", () => {
    // This is the authorization model, expressed as a type: identity
    // comes from the elder's session cookie and nowhere else.
    const parsed = researchConsentSchema.safeParse({
      action: "GRANT",
      userId: "someone-else",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts only the three valid actions", () => {
    for (const action of ["GRANT", "DECLINE", "WITHDRAW"]) {
      expect(researchConsentSchema.safeParse({ action }).success).toBe(true);
    }
    expect(researchConsentSchema.safeParse({ action: "ENABLE" }).success).toBe(
      false,
    );
  });

  it("a caregiver link grants no research consent by itself", async () => {
    const elder = await freshUser("cg-elder");
    const caregiver = await prisma.caregiver.create({
      data: {
        name: `${TAG}-cg`,
        email: `${TAG}-cg@test.local`,
        passwordHash: "x",
      },
    });
    await prisma.caregiverLink.create({
      data: { caregiverId: caregiver.id, userId: elder, status: "ACTIVE" },
    });

    // An ACTIVE care relationship exists, and consent is still absent.
    expect(await researchEligible(elder)).toBe(false);
    expect((await getConsentStatus(elder)).state).toBe("NOT_ASKED");

    await prisma.caregiver.delete({ where: { id: caregiver.id } });
  });
});

describe("consent is deleted with the account", () => {
  it("removes the consent rows when the user is deleted", async () => {
    const id = await freshUser("del");
    await grantConsent(id);
    await prisma.user.delete({ where: { id } });

    expect(await prisma.researchConsent.count({ where: { userId: id } })).toBe(0);
  });
});
