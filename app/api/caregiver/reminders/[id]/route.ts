import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { getReminderForCaregiver } from "@/lib/reminders/queries";
import {
  deleteReminder,
  setReminderEnabled,
  updateReminder,
} from "@/lib/reminders/mutations";
import { reminderInputSchema } from "@/lib/validation/schemas";

/**
 * Update, enable/disable or delete one reminder. Each first re-checks
 * that the reminder exists AND belongs to an elder this caregiver is
 * linked to — a caregiver can never reach another family's reminder by
 * guessing an id (the check returns the same "not found" either way).
 */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getReminderForCaregiver(id, caregiver.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // A bare enable/disable toggle needs no full reminder body.
  if (
    typeof body.enabled === "boolean" &&
    Object.keys(body).length === 1
  ) {
    await setReminderEnabled(caregiver.id, id, body.enabled);
    return NextResponse.json({ ok: true });
  }

  const parsed = reminderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId: existing.userId },
    select: { timeZone: true },
  });
  const timeZone = pref?.timeZone ?? "Asia/Kolkata";

  await updateReminder(caregiver.id, id, timeZone, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteReminder(caregiver.id, id);
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
