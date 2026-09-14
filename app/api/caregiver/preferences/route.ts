import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { updateCaregiverPreference } from "@/lib/caregiver/preferences";
import { caregiverPrefsSchema } from "@/lib/validation/schemas";

/** Update the caregiver's own notification preferences. */
export async function PATCH(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = caregiverPrefsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await updateCaregiverPreference(caregiver.id, parsed.data);
  return NextResponse.json({ ok: true });
}
