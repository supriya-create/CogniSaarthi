import "server-only";

import type { CognitiveDomain } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  DAILY_GOAL,
  getActiveGames,
  getCompletedScoredSessions,
} from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { toSamples } from "@/lib/cognitive-performance/profile";
import {
  buildDailySummary,
  buildWeeklySummary,
  computeWeeklyDomainTrend,
  type DailySummary,
  type WeeklyDomainTrend,
  type WeeklySummary,
} from "@/lib/summaries/compute";
import { getEnabledRemindersForUser, toSchedule } from "@/lib/reminders/queries";
import { occurrencesBetween } from "@/lib/reminders/recurrence";
import {
  localDayBounds,
  statsForDay,
  syncReminderDay,
} from "@/lib/reminders/sync";
import { addDays, dayIndex, localDayOf, zonedTimeToUtc } from "@/lib/reminders/timezone";

/**
 * Server assembly for the daily and weekly caregiver summaries. All the
 * cognitive maths is the Phase 2 engine reused via computeWeeklyDomainTrend
 * — there is no competing score here. The output is deliberately
 * human-readable and is never called a medical report.
 */

const DOMAIN_LABEL: Record<CognitiveDomain, string> = {
  SHORT_TERM_MEMORY: "Memory",
  ATTENTION: "Attention",
  WORKING_MEMORY: "Working memory",
  LANGUAGE: "Language",
  PROCESSING_SPEED: "Processing speed",
  EXECUTIVE_FUNCTION: "Planning",
};

export interface LabelledDomainTrend extends WeeklyDomainTrend {
  label: string;
}

function domainOf(gameId: string, fallback: CognitiveDomain): CognitiveDomain {
  return (getDefinition(gameId)?.domain ?? fallback) as CognitiveDomain;
}

export async function getDailySummary(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<DailySummary> {
  const [dayStart, dayEnd] = localDayBounds(now, timeZone);

  const [sessions, dayItems] = await Promise.all([
    getCompletedScoredSessions(userId),
    syncReminderDay(userId, timeZone, now),
  ]);

  const completedTodaySessions = sessions.filter(
    (s) => s.completedAt && s.completedAt >= dayStart && s.completedAt < dayEnd,
  );
  const domainsCompletedToday = completedTodaySessions.map((s) =>
    domainOf(s.gameId, s.game.domain),
  );
  const stats = statsForDay(dayItems);

  return buildDailySummary({
    completedToday: completedTodaySessions.length,
    dailyGoal: DAILY_GOAL,
    domainsCompletedToday,
    reminderTotalToday: stats.total,
    reminderAcknowledgedToday: stats.acknowledged,
  });
}

export interface WeeklySummaryWithLabels extends WeeklySummary {
  domainTrends: LabelledDomainTrend[];
}

export async function getWeeklySummary(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<WeeklySummaryWithLabels> {
  const today = localDayOf(now, timeZone);
  const weekStart = zonedTimeToUtc(addDays(today, -6), 0, timeZone);

  const [sessions, games, reminders] = await Promise.all([
    getCompletedScoredSessions(userId),
    getActiveGames(),
    getEnabledRemindersForUser(userId),
  ]);

  const samples = toSamples(sessions);
  const weekSessions = sessions.filter(
    (s) => s.completedAt && s.completedAt >= weekStart && s.completedAt <= now,
  );

  // Distinct local days in the week with a completed activity.
  const activeDaySet = new Set<number>();
  for (const s of weekSessions) {
    if (s.completedAt) {
      activeDaySet.add(dayIndex(localDayOf(s.completedAt, timeZone)));
    }
  }

  // Most-played activity this week.
  const counts = new Map<string, number>();
  for (const s of weekSessions) {
    const name = getDefinition(s.gameId)?.name.EN ?? s.game.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let mostUsedActivity: string | null = null;
  let best = 0;
  for (const [name, count] of counts) {
    if (count > best) {
      best = count;
      mostUsedActivity = name;
    }
  }

  // Reminders due so far this week, and how many were acknowledged.
  let reminderTotal = 0;
  for (const reminder of reminders) {
    reminderTotal += occurrencesBetween(
      toSchedule(reminder),
      weekStart,
      now,
      timeZone,
    ).length;
  }
  const reminderAcknowledged = await prisma.reminderLog.count({
    where: {
      userId,
      scheduledFor: { gte: weekStart, lte: now },
      status: { in: ["DONE", "SKIPPED"] },
    },
  });

  // Per-domain before/after using the Phase 2 indicator.
  const seen = new Set<CognitiveDomain>();
  const domainTrends: LabelledDomainTrend[] = [];
  for (const game of games) {
    const domain = domainOf(game.id, game.domain);
    if (seen.has(domain)) continue;
    seen.add(domain);
    const trend = computeWeeklyDomainTrend(domain, samples);
    domainTrends.push({ ...trend, label: DOMAIN_LABEL[domain] });
  }

  return {
    ...buildWeeklySummary({
      weekSessionCount: weekSessions.length,
      activeDays: activeDaySet.size,
      daysInWeek: 7,
      reminderTotal,
      reminderAcknowledged: Math.min(reminderAcknowledged, reminderTotal),
      mostUsedActivity,
      domainTrends,
    }),
    domainTrends,
  };
}
