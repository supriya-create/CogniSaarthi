import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getActiveGames, getRecentSessions } from "@/lib/db/queries";
import { getCognitiveProfile } from "@/lib/cognitive-performance/profile";
import { getDefinition } from "@/lib/game-engine/definitions";
import { getEnabledMemoriesForUser } from "@/lib/memories/queries";
import { getEnabledRemindersForUser } from "@/lib/reminders/queries";
import { localDayBounds } from "@/lib/reminders/sync";
import { DAY_MS } from "@/lib/reminders/timezone";
import type {
  CachedGame,
  CachedMemory,
  CachedProfile,
  CachedReminder,
  OfflineSnapshot,
  SnapshotReminderLog,
  SnapshotSession,
} from "@/lib/offline/types";

/**
 * Builds everything ONE elder's device needs to keep working without a
 * network. Assembled entirely from the authenticated user id — the
 * caller passes no ids of its own, so a device can never ask for
 * somebody else's data.
 *
 * Note what is NOT here: no credentials, no tokens, no caregiver
 * records, and no memory image bytes (images stay behind the existing
 * authenticated route).
 */

/** How much recent history to carry for the offline history screen. */
const HISTORY_LIMIT = 30;
/** How far back to carry reminder answers, for offline day rebuilds. */
const REMINDER_LOG_DAYS = 7;

export async function buildSnapshot(
  userId: string,
  now: Date = new Date(),
): Promise<OfflineSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preference: true },
  });
  if (!user) return null;

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  const [dayStart] = localDayBounds(now, timeZone);
  const logsFrom = new Date(dayStart.getTime() - REMINDER_LOG_DAYS * DAY_MS);

  const [games, cognitive, reminders, memories, sessions, logs] =
    await Promise.all([
      getActiveGames(),
      getCognitiveProfile(userId),
      getEnabledRemindersForUser(userId),
      getEnabledMemoriesForUser(userId),
      getRecentSessions(userId, HISTORY_LIMIT),
      prisma.reminderLog.findMany({
        where: { userId, scheduledFor: { gte: logsFrom } },
        orderBy: { scheduledFor: "desc" },
        take: 200,
      }),
    ]);

  const profile: CachedProfile = {
    id: user.id,
    name: user.name,
    avatarId: user.avatarId,
    language: user.preference?.language ?? user.language,
    fontScale: user.preference?.fontScale ?? "COMFORTABLE",
    reduceMotion: user.preference?.reduceMotion ?? false,
    voiceEnabled: user.preference?.voiceEnabled ?? false,
    autoReadInstructions: user.preference?.autoReadInstructions ?? false,
    speechRate: user.preference?.speechRate ?? "NORMAL",
    timeZone,
    reminderVoice: user.preference?.reminderVoice ?? true,
    autoReadReminders: user.preference?.autoReadReminders ?? false,
    notificationSound: user.preference?.notificationSound ?? true,
  };

  // The level the adaptive engine would choose right now, so an
  // offline game opens at the same difficulty it would online.
  const difficultyByGame = new Map(
    cognitive
      .filter((entry) => entry.gameId !== null)
      .map((entry) => [entry.gameId as string, entry.recommendation.difficulty]),
  );

  const cachedGames: CachedGame[] = games.map((game) => ({
    id: game.id,
    name: getDefinition(game.id)?.name.EN ?? game.name,
    domain: game.domain,
    iconKey: game.iconKey,
    sortOrder: game.sortOrder,
    recommendedDifficulty: difficultyByGame.get(game.id) ?? "EASY",
  }));

  const cachedReminders: CachedReminder[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    timeMinutes: r.timeMinutes,
    recurrence: r.recurrence,
    weekdays: r.weekdays,
    monthDay: r.monthDay,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate ? r.endDate.toISOString() : null,
    enabled: r.enabled,
  }));

  const cachedMemories: CachedMemory[] = memories.map((m) => ({
    id: m.id,
    category: m.category,
    title: m.title,
    relationship: m.relationship,
    description: m.description,
    hasImage: m.imagePath !== null,
  }));

  const cachedLogs: SnapshotReminderLog[] = logs.map((log) => ({
    reminderId: log.reminderId,
    scheduledFor: log.scheduledFor.toISOString(),
    status: log.status,
    acknowledgedAt: log.acknowledgedAt ? log.acknowledgedAt.toISOString() : null,
    snoozedUntil: log.snoozedUntil ? log.snoozedUntil.toISOString() : null,
  }));

  const cachedSessions: SnapshotSession[] = sessions.map((s) => ({
    serverSessionId: s.id,
    clientSessionId: s.clientSessionId,
    gameId: s.gameId,
    difficulty: s.difficulty,
    language: s.language,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    status: s.status,
    score: s.result?.score ?? null,
    accuracy: s.result?.accuracy ?? null,
    stars: s.result?.stars ?? null,
    durationMs: s.durationMs,
  }));

  return {
    userId: user.id,
    contentVersion: contentVersionFor({
      games: cachedGames.length,
      reminders,
      memories,
      profileUpdatedAt: user.preference?.updatedAt ?? user.updatedAt,
    }),
    snapshotAt: now.toISOString(),
    profile,
    games: cachedGames,
    reminders: cachedReminders,
    reminderLogs: cachedLogs,
    memories: cachedMemories,
    sessions: cachedSessions,
  };
}

/**
 * A cheap, deterministic version of the cached server content. When it
 * changes the client replaces its caches wholesale. The playable game
 * CONTENT is not included because it ships inside the app bundle and is
 * therefore versioned by the deployment itself.
 */
function contentVersionFor(input: {
  games: number;
  reminders: { updatedAt: Date }[];
  memories: { updatedAt: Date }[];
  profileUpdatedAt: Date;
}): string {
  const latest = [
    input.profileUpdatedAt,
    ...input.reminders.map((r) => r.updatedAt),
    ...input.memories.map((m) => m.updatedAt),
  ].reduce((max, date) => (date > max ? date : max), new Date(0));

  return `g${input.games}-r${input.reminders.length}-m${input.memories.length}-${latest.getTime()}`;
}
