import { PrismaClient, type Difficulty } from "@prisma/client";

import { starsFor } from "../lib/game-engine/scoring";

/**
 * DEV-ONLY demo data. Gives one user a coherent recent history so the
 * Phase 2 personalisation has something real to work with when you
 * look at it in a browser. It does NOT invent telemetry the app
 * cannot produce — each row is a plausible completed session with a
 * matching result, exactly as gameplay would write.
 *
 * Run against a LOCAL database only:  npx tsx prisma/demo-history.ts
 *
 * Three deliberately different stories so every branch of the engine
 * is visible: strong memory (→ steps up), unstable attention (→ held
 * conservatively), struggling sequence (→ eased down).
 */

const prisma = new PrismaClient();

const STORIES: Record<
  string,
  { difficulty: Difficulty; scores: number[]; avgMs: number }
> = {
  "remember-objects": { difficulty: "EASY", scores: [78, 84, 88, 92, 90], avgMs: 14000 },
  "find-different": { difficulty: "MEDIUM", scores: [95, 55, 90, 60, 92], avgMs: 3800 },
  "remember-sequence": { difficulty: "MEDIUM", scores: [55, 50, 58, 52, 49], avgMs: 9500 },
};

async function main() {
  const guard = process.env.DATABASE_URL ?? "";
  if (!guard.includes("localhost") && !guard.includes("127.0.0.1")) {
    throw new Error("Refusing to run demo seeding against a non-local database.");
  }

  // The oldest real user is the one the caregiver test account links to.
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No user found. Complete onboarding first.");

  console.log(`Seeding demo history for ${user.name} (${user.id})`);

  // Clear this user's existing sessions so the window is exactly the
  // demo history (results cascade-delete with their session).
  const cleared = await prisma.gameSession.deleteMany({
    where: { userId: user.id },
  });
  console.log(`  cleared ${cleared.count} existing sessions`);

  for (const [gameId, story] of Object.entries(STORIES)) {
    const count = story.scores.length;
    for (let i = 0; i < count; i++) {
      const score = story.scores[i];
      // Newest session is ~today; each earlier one a day back. Ordering
      // is oldest→newest so trend reads correctly.
      const daysAgo = count - 1 - i;
      const completedAt = new Date();
      completedAt.setDate(completedAt.getDate() - daysAgo);
      const startedAt = new Date(completedAt.getTime() - 3 * 60 * 1000);
      const accuracy = score / 100;
      const roundsTotal = 5;
      const correct = Math.round(accuracy * roundsTotal);

      await prisma.gameSession.create({
        data: {
          userId: user.id,
          gameId,
          difficulty: story.difficulty,
          language: user.language,
          status: "COMPLETED",
          startedAt,
          completedAt,
          durationMs: 3 * 60 * 1000,
          roundsTotal,
          roundsCompleted: roundsTotal,
          result: {
            create: {
              score,
              accuracy,
              stars: starsFor(accuracy),
              correctCount: correct,
              incorrectCount: roundsTotal - correct,
              mistakes: roundsTotal - correct,
              hints: 0,
              totalResponseTimeMs: story.avgMs * roundsTotal,
              avgResponseTimeMs: story.avgMs,
              rawRounds: [],
            },
          },
        },
      });
    }
    console.log(`  ${gameId}: ${story.scores.length} sessions @ ${story.difficulty}`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
