import "server-only";

import type { Alert, AlertStatus, CognitiveDomain } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/caregiver/access";
import {
  DAILY_GOAL,
  getActiveGames,
  getCompletedScoredSessions,
  getTodaysCompletedCount,
} from "@/lib/db/queries";
import { toSamples } from "@/lib/cognitive-performance/profile";
import { COLD_START_MIN_SESSIONS } from "@/lib/cognitive-performance/config";
import { getDefinition } from "@/lib/game-engine/definitions";
import { computeWeeklyDomainTrend } from "@/lib/summaries/compute";
import {
  deriveAlerts,
  severityRank,
  type AlertContext,
  type DomainSignal,
} from "@/lib/notifications/alerts";
import { statsForDay, syncReminderDay } from "@/lib/reminders/sync";
import { dayIndex, DAY_MS, localDayOf } from "@/lib/reminders/timezone";

/**
 * Server-side alert lifecycle. The DERIVATION is the pure, tested
 * function in lib/notifications/alerts; this module only assembles its
 * input from the database (reusing the Phase 2 engine, never a second
 * scoring system) and persists the results de-duplicated, so a resolved
 * or dismissed alert is never silently recreated.
 */

async function buildAlertContext(
  userId: string,
  timeZone: string,
  now: Date,
): Promise<AlertContext> {
  const [sessions, games, completedToday, dayItems] = await Promise.all([
    getCompletedScoredSessions(userId),
    getActiveGames(),
    getTodaysCompletedCount(userId),
    syncReminderDay(userId, timeZone, now),
  ]);

  const samples = toSamples(sessions);

  // One DomainSignal per active game's domain (deduplicated).
  const seen = new Set<CognitiveDomain>();
  const domains: DomainSignal[] = [];
  for (const game of games) {
    const domain = (getDefinition(game.id)?.domain ??
      game.domain) as CognitiveDomain;
    if (seen.has(domain)) continue;
    seen.add(domain);

    const trend = computeWeeklyDomainTrend(domain, samples);
    const inDomain = samples.filter((s) => s.domain === domain).length;
    domains.push({
      domain,
      trend: trend.trend,
      indicatorNow: trend.current,
      indicatorBaseline: trend.previous,
      coldStart: inDomain < COLD_START_MIN_SESSIONS,
    });
  }

  // Whole local days since the last completed activity.
  let daysSinceLastActivity: number | null = null;
  const lastCompleted = sessions.find((s) => s.completedAt);
  if (lastCompleted?.completedAt) {
    daysSinceLastActivity = Math.floor(
      (dayIndex(localDayOf(now, timeZone)) -
        dayIndex(localDayOf(lastCompleted.completedAt, timeZone))) /
        DAY_MS,
    );
  }

  const stats = statsForDay(dayItems);

  return {
    now,
    timeZone,
    missedToday: stats.missed,
    missedImportantToday: stats.missedImportant,
    daysSinceLastActivity,
    completedToday,
    dailyGoal: DAILY_GOAL,
    domains,
  };
}

/**
 * Recompute alerts for an elder and persist any new ones. Existing
 * alerts (by dedupeKey) are left untouched so a caregiver's read /
 * resolve / dismiss state — and the audit trail — survive.
 */
export async function syncAlerts(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<void> {
  const context = await buildAlertContext(userId, timeZone, now);
  const descriptors = deriveAlerts(context);

  for (const descriptor of descriptors) {
    const existing = await prisma.alert.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: descriptor.dedupeKey } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.alert.create({
      data: {
        userId,
        type: descriptor.type,
        severity: descriptor.severity,
        title: descriptor.title,
        body: descriptor.body,
        dedupeKey: descriptor.dedupeKey,
      },
    });
  }
}

export type AlertFilter = "all" | "unread" | "important" | "resolved";

/** Alerts for the elder a caregiver manages, filtered and ranked. */
export async function getAlertsForCaregiver(
  caregiverId: string,
  userId: string,
  filter: AlertFilter = "all",
): Promise<Alert[]> {
  if (!(await caregiverLinkedTo(caregiverId, userId))) return [];

  const where: {
    userId: string;
    status?: AlertStatus | { in: AlertStatus[] } | { not: AlertStatus };
    severity?: "IMPORTANT";
  } = { userId };
  if (filter === "unread") where.status = "UNREAD";
  else if (filter === "resolved") where.status = { in: ["RESOLVED", "DISMISSED"] };
  else if (filter === "important") where.severity = "IMPORTANT";
  else where.status = { not: "DISMISSED" };

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Strongest severity first, then newest.
  return alerts.sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Count of alerts still needing attention (unread, not dismissed). */
export async function countUnreadAlerts(userId: string): Promise<number> {
  return prisma.alert.count({ where: { userId, status: "UNREAD" } });
}

export type AlertAction = "read" | "resolve" | "dismiss";

/**
 * Change an alert's status, only for a caregiver linked to its elder.
 * Dismiss and resolve retain the record (with metadata) rather than
 * deleting it, so important history is not lost to tidying.
 */
export async function updateAlertStatus(
  caregiverId: string,
  alertId: string,
  action: AlertAction,
  now: Date = new Date(),
): Promise<"ok" | "not_found"> {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) return "not_found";
  if (!(await caregiverLinkedTo(caregiverId, alert.userId))) return "not_found";

  if (action === "read") {
    await prisma.alert.update({
      where: { id: alertId },
      data: { status: "READ", readAt: alert.readAt ?? now },
    });
  } else if (action === "resolve") {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        resolvedByCaregiverId: caregiverId,
        readAt: alert.readAt ?? now,
      },
    });
  } else {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "DISMISSED",
        resolvedAt: alert.resolvedAt ?? now,
        resolvedByCaregiverId: caregiverId,
      },
    });
  }
  return "ok";
}
