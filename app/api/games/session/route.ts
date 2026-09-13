import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { startSessionSchema } from "@/lib/validation/schemas";
import { isGameId, roundCountFor } from "@/lib/game-engine/definitions";

/**
 * Opens a game session. Called the moment play begins so that an
 * abandoned attempt still leaves a row — knowing that someone
 * started three activities and finished one is more useful to a
 * caregiver than seeing only the finished one.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = startSessionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { gameId, difficulty, clientSessionId } = parsed.data;
  if (!isGameId(gameId)) {
    return NextResponse.json({ error: "unknown_game" }, { status: 404 });
  }

  // Replayed offline writes must not create a second session.
  if (clientSessionId) {
    const existing = await prisma.gameSession.findUnique({
      where: { clientSessionId },
      select: { id: true, userId: true },
    });
    if (existing && existing.userId === user.id) {
      return NextResponse.json({ sessionId: existing.id });
    }
  }

  const session = await prisma.gameSession.create({
    data: {
      userId: user.id,
      gameId,
      difficulty,
      language: user.preference?.language ?? user.language,
      roundsTotal: roundCountFor(gameId, difficulty),
      clientSessionId,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: session.id });
}
