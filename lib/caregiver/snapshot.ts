import "server-only";

import { getCaregiverOverview } from "@/lib/db/queries";
import { timeZoneForUser } from "@/lib/caregiver/access";
import { getAlertsForCaregiver } from "@/lib/caregiver/alerts";
import { getDefinition } from "@/lib/game-engine/definitions";
import { getIntelligenceSnapshot } from "@/lib/intelligence/server";
import { recordAudit } from "@/lib/privacy/audit";
import { syncReminderDay } from "@/lib/reminders/sync";
import { getDailySummary } from "@/lib/summaries/queries";
import type { TrendClass } from "@/lib/intelligence/types";
import {
  CAREGIVER_SNAPSHOT_VERSION,
  SNAPSHOT_TTL_MS,
  type CaregiverSnapshot,
  type SnapshotTrendRow,
} from "@/lib/caregiver/snapshot-types";

/**
 * CAREGIVER OFFLINE — building the snapshot, server-side.
 * -----------------------------------------------------------------
 * ## The one security rule
 *
 * This function takes a `caregiverId` and NOTHING ELSE. It does not
 * accept an elder id, it does not read one from a request body, and it
 * does not read one from a URL. The elder is determined here, from the
 * caregiver's own ACTIVE link, by the same `getCaregiverOverview` the
 * online dashboard uses.
 *
 * That is deliberate and it is the whole model: there is no parameter a
 * caller could forge. A caregiver linked to Elder A cannot describe
 * Elder B to this function, because the function does not ask.
 *
 * ## What it carries
 *
 * The minimum that makes "how are they doing?" answerable without a
 * network. See `snapshot-types.ts` for the full list of what is
 * excluded and why — briefly: no photos, no memory content, no note
 * bodies, no emergency contacts, no reminder titles, no credentials.
 */

/** How much recent history the caregiver can see offline. */
const SESSION_LIMIT = 8;
const ALERT_LIMIT = 5;

function trendDirection(classification: TrendClass): SnapshotTrendRow["direction"] {
  switch (classification) {
    case "IMPROVING":
      return "IMPROVING";
    case "DECLINING":
      return "DECLINING";
    case "STABLE":
      return "STEADY";
    // VARIABLE and INSUFFICIENT_DATA are both "we do not know", and
    // flattening them to STEADY would be a claim we cannot support.
    default:
      return "UNKNOWN";
  }
}

export async function buildCaregiverSnapshot(
  caregiverId: string,
  now: Date = new Date(),
): Promise<CaregiverSnapshot | null> {
  const overview = await getCaregiverOverview(caregiverId);
  if (!overview) return null;

  const { user, link, sessions } = overview;
  const timeZone = await timeZoneForUser(user.id);

  // `syncReminderDay` MATERIALISES today's occurrences, and so does
  // `getDailySummary` internally. Running them concurrently makes two
  // writers race for the same (reminderId, scheduledFor) unique key and
  // one of them loses with a constraint violation. So the day is synced
  // once, first, and the rest — which only read — run in parallel.
  const reminderDay = await syncReminderDay(user.id, timeZone, now);

  const [daily, alerts, intelligence] = await Promise.all([
    getDailySummary(user.id, timeZone, now),
    getAlertsForCaregiver(caregiverId, user.id, "all"),
    getIntelligenceSnapshot(user.id),
  ]);

  const snapshot: CaregiverSnapshot = {
    snapshotVersion: CAREGIVER_SNAPSHOT_VERSION,
    caregiverId,
    elderId: user.id,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS).toISOString(),
    data: {
      elder: {
        name: user.name,
        avatarId: user.avatarId,
        relationship: link.relationship,
      },
      today: {
        activitiesCompleted: daily.activities.completed,
        activitiesGoal: daily.activities.goal,
        remindersAcknowledged: daily.reminders.acknowledged,
        remindersTotal: daily.reminders.total,
        averageScore: overview.averageScore,
      },
      recentSessions: sessions.slice(0, SESSION_LIMIT).map((session) => ({
        gameId: session.gameId,
        gameName: getDefinition(session.gameId)?.name.EN ?? session.game.name,
        difficulty: session.difficulty,
        score: session.result?.score ?? null,
        stars: session.result?.stars ?? null,
        completedAt: session.completedAt
          ? session.completedAt.toISOString()
          : null,
        status: session.status,
      })),
      // Category, time and status only — see snapshot-types.ts on why
      // the reminder's own title is left behind.
      reminders: reminderDay.map((item) => ({
        category: item.category,
        timeMinutes: item.timeMinutes,
        status: item.status ?? "PENDING",
      })),
      alerts: alerts.slice(0, ALERT_LIMIT).map((alert) => ({
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        createdAt: alert.createdAt.toISOString(),
        unread: alert.status === "UNREAD",
      })),
      trends: intelligence.profiles
        // A domain nobody has played has no trend to report, and an
        // empty row would read as "no change" rather than "no data".
        .filter((profile) => profile.activityCount > 0)
        .map((profile) => ({
          domain: profile.domain,
          label: profile.domain
            .split("_")
            .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
            .join(" "),
          direction: trendDirection(profile.trend.classification),
          confidence: profile.confidence,
        })),
    },
  };

  await recordAudit({
    action: "CAREGIVER_SNAPSHOT_ISSUED",
    userId: user.id,
    caregiverId,
    detail: {
      sessionCount: snapshot.data.recentSessions.length,
      alertCount: snapshot.data.alerts.length,
      version: String(CAREGIVER_SNAPSHOT_VERSION),
    },
  });

  return snapshot;
}
