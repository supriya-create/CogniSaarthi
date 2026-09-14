import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import {
  deleteEmergencyContact,
  updateEmergencyContact,
} from "@/lib/caregiver/emergency";
import { emergencyContactSchema } from "@/lib/validation/schemas";

/** Edit or remove one emergency contact, only for a linked caregiver. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = emergencyContactSchema.partial().safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await updateEmergencyContact(caregiver.id, id, {
    name: parsed.data.name,
    phone: parsed.data.phone,
    relationship:
      parsed.data.relationship === "" ? "Family member" : parsed.data.relationship,
  });
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
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
  const result = await deleteEmergencyContact(caregiver.id, id);
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
