import { prisma } from "@/lib/db/prisma";
import { startOfDay } from "@/lib/utils/date";

/**
 * Read models. Pages call these rather than reaching for Prisma
 * directly, so the shape of a "session with its result" is defined
 * once and the caregiver view cannot drift from the elder view.
 */

/** How many activities make up a full day. Deliberately small. */
export const DAILY_GOAL = 3;

const sessionWithResult = {
  include: {
    game: { select: { id: true, name: true, domain: true, iconKey: true } },
    result: true,
  },
} as const;

export type SessionWithResult = Awaited<
  ReturnType<typeof getRecentSessions>
>[number];

export async function getRecentSessions(userId: string, take = 30) {
  return prisma.gameSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take,
    ...sessionWithResult,
  });
}

export async function getSessionForUser(sessionId: string, userId: string) {
  return prisma.gameSession.findFirst({
    where: { id: sessionId, userId },
    ...sessionWithResult,
  });
}

/**
 * Completed, scored sessions for the cognitive-performance engine.
 * Ordered oldest-last (newest first) and taken generously so the
 * engine can window the most recent few per domain itself.
 */
export async function getCompletedScoredSessions(userId: string, take = 60) {
  return prisma.gameSession.findMany({
    where: { userId, status: "COMPLETED", result: { isNot: null } },
    orderBy: { completedAt: "desc" },
    take,
    ...sessionWithResult,
  });
}

/** Completed activities since midnight IST, used for the home dots. */
export async function getTodaysCompletedCount(userId: string) {
  return prisma.gameSession.count({
    where: {
      userId,
      status: "COMPLETED",
      completedAt: { gte: startOfDay() },
    },
  });
}

/** Game ids the person has already finished today. */
export async function getGameIdsCompletedToday(userId: string) {
  const rows = await prisma.gameSession.findMany({
    where: {
      userId,
      status: "COMPLETED",
      completedAt: { gte: startOfDay() },
    },
    select: { gameId: true },
    distinct: ["gameId"],
  });
  return new Set(rows.map((row) => row.gameId));
}

export async function getActiveGames() {
  return prisma.game.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getCaregiverLink(userId: string) {
  return prisma.caregiverLink.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { caregiver: { select: { id: true, name: true } } },
  });
}

/** Everything the caregiver dashboard needs about one connected person. */
export async function getCaregiverOverview(caregiverId: string) {
  const link = await prisma.caregiverLink.findFirst({
    where: { caregiverId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  if (!link) return null;

  const [sessions, completedToday, totalCompleted] = await Promise.all([
    getRecentSessions(link.userId, 10),
    getTodaysCompletedCount(link.userId),
    prisma.gameSession.count({
      where: { userId: link.userId, status: "COMPLETED" },
    }),
  ]);

  const scored = sessions.filter((s) => s.result !== null);
  const averageScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, s) => sum + (s.result?.score ?? 0), 0) /
            scored.length,
        )
      : null;

  return {
    link,
    user: link.user,
    sessions,
    completedToday,
    totalCompleted,
    averageScore,
  };
}
