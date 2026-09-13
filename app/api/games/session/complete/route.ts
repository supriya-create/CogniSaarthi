import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { completeSessionSchema } from "@/lib/validation/schemas";
import { summarise } from "@/lib/game-engine/scoring";

/**
 * Closes a session and writes its result.
 *
 * The score is recomputed here from the round data rather than
 * accepted from the client, so every GameResult in the database was
 * produced by one function. The rounds themselves still originate on
 * the device — the games run entirely in the browser in Phase 1 —
 * which is fine for a wellbeing app but is worth remembering before
 * this data is ever used for anything clinical.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = completeSessionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { sessionId, rounds, durationMs } = parsed.data;

  const session = await prisma.gameSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { result: true },
  });

  if (!session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Idempotent: a retried submission returns the existing result.
  if (session.result) {
    return NextResponse.json({ sessionId: session.id, alreadyCompleted: true });
  }

  const summary = summarise({
    rounds: rounds.map((round) => ({ ...round, detail: round.detail })),
    durationMs,
  });

  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        roundsCompleted: rounds.length,
      },
    }),
    prisma.gameResult.create({
      data: {
        sessionId: session.id,
        score: summary.score,
        accuracy: summary.accuracy,
        stars: summary.stars,
        correctCount: summary.correctCount,
        incorrectCount: summary.incorrectCount,
        mistakes: summary.mistakes,
        hints: summary.hints,
        totalResponseTimeMs: summary.totalResponseTimeMs,
        avgResponseTimeMs: summary.avgResponseTimeMs,
        // Validated by completeSessionSchema above; Prisma's Json
        // input type cannot express "array of known objects".
        rawRounds: rounds as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  return NextResponse.json({ sessionId: session.id });
}
