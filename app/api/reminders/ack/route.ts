import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { acknowledgeOccurrence } from "@/lib/reminders/sync";
import { acknowledgeReminderSchema } from "@/lib/validation/schemas";

/**
 * The elder answers one reminder occurrence: Done, Skip or Later. The
 * reminder must belong to the signed-in elder, and the instant must be
 * a genuine occurrence of it — both are re-checked server-side. For a
 * MEDICATION reminder, "Done" means acknowledged, never "medication
 * taken".
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = acknowledgeReminderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const scheduledFor = new Date(parsed.data.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  const result = await acknowledgeOccurrence(
    user.id,
    parsed.data.reminderId,
    scheduledFor,
    parsed.data.action,
    timeZone,
  );

  if (result !== "ok") {
    return NextResponse.json({ error: result }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
