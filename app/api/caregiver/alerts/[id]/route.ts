import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { updateAlertStatus } from "@/lib/caregiver/alerts";
import { alertActionSchema } from "@/lib/validation/schemas";

/**
 * Mark an alert read, resolve it, or dismiss it. Only a caregiver
 * linked to the alert's elder may act; dismiss and resolve keep the
 * record (with metadata) rather than deleting the audit trail.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = alertActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await updateAlertStatus(caregiver.id, id, parsed.data.action);
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
