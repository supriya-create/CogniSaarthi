import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { startSession } from "@/lib/auth/session";
import { onboardingSchema } from "@/lib/validation/schemas";
import { generateConnectCode } from "@/lib/utils/connect-code";

/**
 * Creates the elderly user's profile and signs them in.
 *
 * There is no password step by design: the person using this app may
 * not manage credentials, and the device is typically their own or
 * their family's. The caregiver side, which can see this person's
 * data, does authenticate properly.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, language } = parsed.data;

  // The connect code is unique; retry the rare collision rather than
  // failing the very first thing the user ever does in the app.
  let user = null;
  for (let attempt = 0; attempt < 5 && !user; attempt++) {
    try {
      user = await prisma.user.create({
        data: {
          name,
          language,
          connectCode: generateConnectCode(),
          preference: { create: { language } },
        },
      });
    } catch (error) {
      const isCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isCollision) throw error;
    }
  }

  if (!user) {
    return NextResponse.json({ error: "could_not_create" }, { status: 500 });
  }

  await startSession({ sub: user.id, role: "ELDER" });

  return NextResponse.json({ id: user.id });
}
