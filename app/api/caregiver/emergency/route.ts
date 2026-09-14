import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { createEmergencyContact } from "@/lib/caregiver/emergency";
import { emergencyContactSchema } from "@/lib/validation/schemas";

/** Add an emergency contact for the caregiver's linked elder. */
export async function POST(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await linkedUserFor(caregiver.id);
  if (!user) {
    return NextResponse.json({ error: "no_linked_user" }, { status: 400 });
  }

  const parsed = emergencyContactSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const contact = await createEmergencyContact(caregiver.id, user.id, {
    name: parsed.data.name,
    phone: parsed.data.phone,
    relationship: parsed.data.relationship || "Family member",
  });
  if (!contact) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }
  return NextResponse.json({ id: contact.id });
}
