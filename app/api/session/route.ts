import { NextResponse } from "next/server";

import { endSession, type SessionRole } from "@/lib/auth/session";

/**
 * Signs out one role.
 *
 * Elder and caregiver sessions live in separate cookies (see
 * lib/auth/session.ts), so this must be told which one to end — a
 * caregiver signing out on a shared tablet must leave the elder
 * signed in.
 */
export async function DELETE(request: Request) {
  const role = new URL(request.url).searchParams.get("role");

  if (role !== "ELDER" && role !== "CAREGIVER") {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  await endSession(role as SessionRole);
  return NextResponse.json({ ok: true });
}
