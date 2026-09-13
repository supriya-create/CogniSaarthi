import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

const schema = z.object({ sessionId: z.string().min(1) });

/**
 * Closes a session the person chose to stop.
 *
 * Without this, "Stop activity" would leave the row at IN_PROGRESS
 * forever and there would be no way to tell someone who walked away
 * from someone whose tablet is still open on the screen. A caregiver
 * seeing "started three, finished one" is being told something true;
 * seeing three permanently in-progress rows is being told nothing.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Scoped to this user and to sessions that are still open, so a
  // completed session can never be walked back to abandoned.
  await prisma.gameSession.updateMany({
    where: {
      id: parsed.data.sessionId,
      userId: user.id,
      status: "IN_PROGRESS",
    },
    data: { status: "ABANDONED", completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
