import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { caregiverLoginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = caregiverLoginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const caregiver = await prisma.caregiver.findUnique({ where: { email } });

  // One message and one code for both "no such account" and "wrong
  // password", so the endpoint cannot be used to discover which
  // family members have signed up.
  const ok =
    caregiver !== null &&
    (await verifyPassword(password, caregiver.passwordHash));

  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await startSession({ sub: caregiver.id, role: "CAREGIVER" });
  return NextResponse.json({ id: caregiver.id });
}
