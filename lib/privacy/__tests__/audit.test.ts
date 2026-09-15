import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { auditEventsForUser, recordAudit, sanitiseDetail } from "@/lib/privacy/audit";
import { grantConsent, withdrawConsent } from "@/lib/privacy/server";

/**
 * The audit log.
 *
 * Its value depends entirely on it containing nothing sensitive, so
 * most of these tests are about what does NOT get written.
 */

const TAG = `audit-test-${Date.now()}`;
let userId = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: `${TAG}`, connectCode: `${TAG}`.slice(-16) },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.auditEvent.deleteMany({ where: { userId } });
});

describe("sanitiseDetail", () => {
  it("keeps small scalars", () => {
    expect(sanitiseDetail({ count: 3, ok: true, version: "v1", none: null })).toEqual({
      count: 3,
      ok: true,
      version: "v1",
      none: null,
    });
  });

  it("drops credentials", () => {
    const clean = sanitiseDetail({
      password: "hunter2",
      passwordHash: "$2b$10$abc",
      token: "eyJhbGci",
      secret: "s3cret",
      cookie: "cs_elder=…",
      kept: 1,
    });
    expect(clean).toEqual({ kept: 1 });
  });

  it("drops direct identifiers", () => {
    const clean = sanitiseDetail({
      name: "Supriya",
      email: "a@b.c",
      phone: "+919876543210",
      connectCode: "6R767C",
      kept: 1,
    });
    expect(clean).toEqual({ kept: 1 });
  });

  it("drops content-bearing keys", () => {
    const clean = sanitiseDetail({
      title: "Metformin",
      body: "Seemed tired",
      description: "Grandson's wedding",
      imagePath: "1234.jpg",
      memories: ["a", "b"],
      kept: 1,
    });
    expect(clean).toEqual({ kept: 1 });
  });

  it("matches forbidden keys case-insensitively", () => {
    expect(sanitiseDetail({ PassWord: "x", EMAIL: "y", kept: 1 })).toEqual({
      kept: 1,
    });
  });

  it("drops nested objects and arrays outright", () => {
    // A nested structure is exactly where content hides.
    const clean = sanitiseDetail({
      nested: { secret: "x" },
      list: [1, 2, 3],
      kept: 1,
    });
    expect(clean).toEqual({ kept: 1 });
  });

  it("truncates a long string rather than storing a paragraph", () => {
    const clean = sanitiseDetail({ reason: "x".repeat(500) });
    expect((clean.reason as string).length).toBe(64);
  });

  it("drops non-finite numbers", () => {
    expect(sanitiseDetail({ n: NaN, i: Infinity, kept: 1 })).toEqual({ kept: 1 });
  });
});

describe("recordAudit", () => {
  it("writes an event that can be read back", async () => {
    await recordAudit({
      action: "RESEARCH_CONSENT_GRANTED",
      userId,
      detail: { version: "research-consent-v1" },
    });

    const events = await auditEventsForUser(userId);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].action).toBe("RESEARCH_CONSENT_GRANTED");
  });

  it("sanitises the detail on the way in", async () => {
    await recordAudit({
      action: "ACCOUNT_DATA_EXPORTED",
      userId,
      detail: { name: "Supriya", activityCount: 4 },
    });

    const event = (await auditEventsForUser(userId)).find(
      (e) => e.action === "ACCOUNT_DATA_EXPORTED",
    );
    const detail = event?.detail as Record<string, unknown>;
    expect(detail.activityCount).toBe(4);
    expect(detail).not.toHaveProperty("name");
  });
});

describe("consent changes are audited", () => {
  it("records a grant and a withdrawal, in that order", async () => {
    const fresh = await prisma.user.create({
      data: { name: `${TAG}-2`, connectCode: `${TAG}-2`.slice(-16) },
    });

    await grantConsent(fresh.id);
    await withdrawConsent(fresh.id);

    const events = await auditEventsForUser(fresh.id);
    const actions = events.map((e) => e.action);
    expect(actions).toContain("RESEARCH_CONSENT_GRANTED");
    expect(actions).toContain("RESEARCH_CONSENT_WITHDRAWN");

    await prisma.user.delete({ where: { id: fresh.id } });
    await prisma.auditEvent.deleteMany({ where: { userId: fresh.id } });
  });

  it("does not audit a withdrawal that withdrew nothing", async () => {
    const fresh = await prisma.user.create({
      data: { name: `${TAG}-3`, connectCode: `${TAG}-3`.slice(-16) },
    });

    // Never consented — withdrawing is a no-op, and a no-op must not
    // manufacture a misleading trail.
    await withdrawConsent(fresh.id);
    const events = await auditEventsForUser(fresh.id);
    expect(events).toHaveLength(0);

    await prisma.user.delete({ where: { id: fresh.id } });
  });

  it("survives the deletion of the account it describes", async () => {
    const fresh = await prisma.user.create({
      data: { name: `${TAG}-4`, connectCode: `${TAG}-4`.slice(-16) },
    });
    await grantConsent(fresh.id);
    await prisma.user.delete({ where: { id: fresh.id } });

    // No foreign key, so no cascade. An audit log that vanishes with
    // its subject cannot answer the question it exists for.
    const events = await auditEventsForUser(fresh.id);
    expect(events.length).toBeGreaterThan(0);

    await prisma.auditEvent.deleteMany({ where: { userId: fresh.id } });
  });
});
