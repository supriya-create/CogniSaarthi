import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { createReminder } from "@/lib/reminders/mutations";
import { reminderInputSchema } from "@/lib/validation/schemas";

/**
 * Create a reminder for the elder this caregiver is linked to.
 * Authorization is implicit: the reminder is always created for the
 * caregiver's OWN linked elder, and the time is stored against that
 * elder's timezone.
 */
export async function POST(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await linkedUserFor(caregiver.id);
  if (!user) {
    return NextResponse.json({ error: "no_linked_user" }, { status: 400 });
  }

  const parsed = reminderInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  const reminder = await createReminder(
    caregiver.id,
    user.id,
    timeZone,
    parsed.data,
  );
  if (!reminder) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  return NextResponse.json({ id: reminder.id });
}
