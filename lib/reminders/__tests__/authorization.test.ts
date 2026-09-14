import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  getReminderForCaregiver,
} from "@/lib/reminders/queries";
import {
  createReminder,
  deleteReminder,
  updateReminder,
} from "@/lib/reminders/mutations";
import { acknowledgeOccurrence } from "@/lib/reminders/sync";
import {
  createNote,
  deleteNote,
  getOwnNote,
  updateNote,
} from "@/lib/caregiver/notes";
import {
  createEmergencyContact,
  getContactForCaregiver,
} from "@/lib/caregiver/emergency";
import {
  getAlertsForCaregiver,
  updateAlertStatus,
} from "@/lib/caregiver/alerts";
import { zonedTimeToUtc } from "@/lib/reminders/timezone";
import type { ReminderInput } from "@/lib/validation/schemas";

/**
 * SECURITY: a caregiver must never reach a reminder, note, alert or
 * emergency contact for an elder they are not linked to — and one elder
 * must never acknowledge another's reminder. Exercised against the real
 * query/mutation helpers with two separate family units.
 */

const TZ = "Asia/Kolkata";
const TAG = `r-authz-${Date.now()}`;
let userA = "";
let userB = "";
let cgA = "";
let cgB = "";
let reminderA = "";
let noteA = "";
let contactA = "";
let alertA = "";

const reminderInput: ReminderInput = {
  title: "Morning medication",
  description: "",
  category: "MEDICATION",
  priority: "NORMAL",
  time: "08:00",
  recurrence: "DAILY",
  weekdays: [],
  monthDay: null,
  startDate: "2026-09-01",
  endDate: null,
  enabled: true,
};

beforeAll(async () => {
  const uA = await prisma.user.create({
    data: { name: `${TAG}-uA`, connectCode: `${TAG}-A` },
  });
  const uB = await prisma.user.create({
    data: { name: `${TAG}-uB`, connectCode: `${TAG}-B` },
  });
  const cA = await prisma.caregiver.create({
    data: { name: `${TAG}-cA`, email: `${TAG}-a@test.local`, passwordHash: "x" },
  });
  const cB = await prisma.caregiver.create({
    data: { name: `${TAG}-cB`, email: `${TAG}-b@test.local`, passwordHash: "x" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: cA.id, userId: uA.id, status: "ACTIVE" },
  });
  await prisma.caregiverLink.create({
    data: { caregiverId: cB.id, userId: uB.id, status: "ACTIVE" },
  });

  userA = uA.id;
  userB = uB.id;
  cgA = cA.id;
  cgB = cB.id;

  const reminder = await createReminder(cgA, userA, TZ, reminderInput);
  reminderA = reminder!.id;

  const note = await createNote(cgA, userA, { body: "Slept well", category: "SLEEP" });
  noteA = note!.id;

  const contact = await createEmergencyContact(cgA, userA, {
    name: "Asha",
    phone: "+911234567890",
    relationship: "Daughter",
  });
  contactA = contact!.id;

  const alert = await prisma.alert.create({
    data: {
      userId: userA,
      type: "DAILY_COMPLETE",
      severity: "INFO",
      title: "Today's activities are complete",
      body: "All done.",
      dedupeKey: `${TAG}-complete`,
    },
  });
  alertA = alert.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.caregiver.deleteMany({ where: { id: { in: [cgA, cgB] } } });
  await prisma.$disconnect();
});

describe("reminder authorization", () => {
  it("creates only for a linked elder", async () => {
    expect(await createReminder(cgB, userA, TZ, reminderInput)).toBeNull();
  });
  it("hides another family's reminder", async () => {
    expect((await getReminderForCaregiver(reminderA, cgA))?.id).toBe(reminderA);
    expect(await getReminderForCaregiver(reminderA, cgB)).toBeNull();
  });
  it("refuses cross-family update and delete", async () => {
    expect(await updateReminder(cgB, reminderA, TZ, reminderInput)).toBe(
      "not_found",
    );
    expect(await deleteReminder(cgB, reminderA)).toBe("not_found");
  });
});

describe("reminder acknowledgement authorization", () => {
  const occurrence = zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 480, TZ);

  it("lets the owning elder acknowledge a real occurrence", async () => {
    expect(
      await acknowledgeOccurrence(userA, reminderA, occurrence, "DONE", TZ),
    ).toBe("ok");
  });
  it("rejects another elder acknowledging it", async () => {
    expect(
      await acknowledgeOccurrence(userB, reminderA, occurrence, "DONE", TZ),
    ).toBe("not_found");
  });
  it("rejects an instant that is not an occurrence", async () => {
    const bogus = zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 540, TZ);
    expect(
      await acknowledgeOccurrence(userA, reminderA, bogus, "DONE", TZ),
    ).toBe("invalid_occurrence");
  });
});

describe("note authorization", () => {
  it("creates only for a linked elder", async () => {
    expect(await createNote(cgB, userA, { body: "x", category: "GENERAL" })).toBeNull();
  });
  it("edits/deletes only the author's own note", async () => {
    expect((await getOwnNote(noteA, cgA))?.id).toBe(noteA);
    expect(await getOwnNote(noteA, cgB)).toBeNull();
    expect(await updateNote(cgB, noteA, { body: "hacked" })).toBe("not_found");
    expect(await deleteNote(cgB, noteA)).toBe("not_found");
  });
});

describe("emergency contact authorization", () => {
  it("creates only for a linked elder", async () => {
    expect(
      await createEmergencyContact(cgB, userA, {
        name: "x",
        phone: "1",
        relationship: "y",
      }),
    ).toBeNull();
  });
  it("hides another family's contact", async () => {
    expect((await getContactForCaregiver(contactA, cgA))?.id).toBe(contactA);
    expect(await getContactForCaregiver(contactA, cgB)).toBeNull();
  });
});

describe("alert authorization", () => {
  it("lists alerts only for a linked caregiver", async () => {
    expect((await getAlertsForCaregiver(cgA, userA, "all")).length).toBeGreaterThan(0);
    expect(await getAlertsForCaregiver(cgB, userA, "all")).toEqual([]);
  });
  it("refuses cross-family status changes", async () => {
    expect(await updateAlertStatus(cgB, alertA, "read")).toBe("not_found");
    expect(await updateAlertStatus(cgA, alertA, "resolve")).toBe("ok");
  });
});
