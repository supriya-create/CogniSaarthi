import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";

const schema = z.object({ timeZone: z.string().trim().min(1).max(64) });

/**
 * Set the connected elder's reminder timezone. Reminders are stored as
 * wall-clock times against this zone, so a caregiver correcting it keeps
 * "08:00" meaning 08:00 where the elder actually is.
 */
export async function PATCH(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await linkedUserFor(caregiver.id);
  if (!user) {
    return NextResponse.json({ error: "no_linked_user" }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Validate it is a real IANA zone the runtime understands.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timeZone });
  } catch {
    return NextResponse.json({ error: "invalid_timezone" }, { status: 400 });
  }

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, timeZone: parsed.data.timeZone },
    update: { timeZone: parsed.data.timeZone },
  });

  return NextResponse.json({ ok: true });
}
