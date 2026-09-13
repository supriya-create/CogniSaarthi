import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { caregiverSignupSchema } from "@/lib/validation/schemas";
import { normaliseConnectCode } from "@/lib/utils/connect-code";

/**
 * Creates a caregiver account and links it to one elderly user.
 *
 * The link requires the code shown on that person's own profile
 * screen, so a caregiver cannot attach themselves to someone
 * without physical or spoken access to them. That is the whole of
 * the consent model in Phase 1, and it is deliberately narrow.
 */
export async function POST(request: Request) {
  const parsed = caregiverSignupSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, password, connectCode } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { connectCode: normaliseConnectCode(connectCode) },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "unknown_code" }, { status: 404 });
  }

  try {
    const caregiver = await prisma.caregiver.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        links: { create: { userId: user.id } },
      },
      select: { id: true },
    });

    await startSession({ sub: caregiver.id, role: "CAREGIVER" });
    return NextResponse.json({ id: caregiver.id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    throw error;
  }
}
