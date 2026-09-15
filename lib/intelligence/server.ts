import "server-only";

import { cache } from "react";
import type { CognitiveDomain, Difficulty } from "@prisma/client";

import {
  getActiveGames,
  getCompletedScoredSessions,
  getGameIdsCompletedToday,
} from "@/lib/db/queries";
import { computeDomainPerformance } from "@/lib/cognitive-performance/performance";
import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import { toSamples } from "@/lib/cognitive-performance/profile";
import { getDefinition } from "@/lib/game-engine/definitions";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import { timeZoneForUser } from "@/lib/caregiver/access";
import { INTELLIGENCE_HISTORY_LIMIT } from "@/lib/intelligence/config";
import { ACTIVE_DOMAINS } from "@/lib/intelligence/domains";
import {
  buildAllDomainProfiles,
  computeActivityRoutine,
} from "@/lib/intelligence/longitudinal";
import { buildDailyPlan } from "@/lib/intelligence/daily-plan";
import type {
  ActivityRoutine,
  DailyPlan,
  LongitudinalDomainProfile,
} from "@/lib/intelligence/types";

/**
 * The only part of the intelligence layer that touches the database.
 *
 * It reads a person's real history once, hands it to the pure engine,
 * and is wrapped in React's `cache()` so a page that shows the plan,
 * the profiles and the routine costs ONE query set per request rather
 * than three. Nothing here is persisted: every value is derived from
 * `GameSession`/`GameResult` on demand, which keeps the source of truth
 * singular and means there is no stale derived table to reconcile.
 */

export interface IntelligenceSnapshot {
  profiles: LongitudinalDomainProfile[];
  routine: ActivityRoutine;
  samples: PerformanceSample[];
  /** The level Phase 2 would open each domain at. */
  difficultyByDomain: Map<CognitiveDomain, Difficulty>;
  recentGameIds: string[];
  preferredGameIds: string[];
  timeZone: string;
}

export const getIntelligenceSnapshot = cache(
  async (userId: string): Promise<IntelligenceSnapshot> => {
    const now = new Date();

    const [sessions, timeZone] = await Promise.all([
      getCompletedScoredSessions(userId, INTELLIGENCE_HISTORY_LIMIT),
      timeZoneForUser(userId),
    ]);

    const samples = toSamples(sessions);
    const profiles = buildAllDomainProfiles(samples, now);
    const routine = computeActivityRoutine(samples, now, timeZone);

    // Difficulty comes from the PHASE 2 engine, unchanged. This layer
    // orchestrates; it does not decide levels.
    const difficultyByDomain = new Map<CognitiveDomain, Difficulty>();
    for (const domain of ACTIVE_DOMAINS) {
      const performance = computeDomainPerformance(domain, samples);
      difficultyByDomain.set(domain, recommendDifficulty(performance).difficulty);
    }

    // Newest first; the engine uses this to avoid repeating itself.
    const recentGameIds = sessions
      .filter((s) => s.completedAt !== null)
      .map((s) => s.gameId);

    return {
      profiles,
      routine,
      samples,
      difficultyByDomain,
      recentGameIds,
      preferredGameIds: mostPlayed(recentGameIds),
      timeZone,
    };
  },
);

/** The two activities someone reaches for most often. */
function mostPlayed(gameIds: string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of gameIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);
}

/** The personalised plan for today. */
export const getDailyPlan = cache(async (userId: string): Promise<DailyPlan> => {
  const [snapshot, completedToday, games] = await Promise.all([
    getIntelligenceSnapshot(userId),
    getGameIdsCompletedToday(userId),
    getActiveGames(),
  ]);

  const availableGames = games.map((game) => ({
    gameId: game.id,
    domain: (getDefinition(game.id)?.domain ?? game.domain) as CognitiveDomain,
  }));

  return buildDailyPlan({
    profiles: snapshot.profiles,
    routine: snapshot.routine,
    availableGames,
    recentGameIds: snapshot.recentGameIds,
    completedTodayGameIds: [...completedToday],
    difficultyByDomain: snapshot.difficultyByDomain,
    preferredGameIds: snapshot.preferredGameIds,
    completedToday: completedToday.size,
    recentSamples: snapshot.samples,
  });
});
