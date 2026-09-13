import "server-only";

import type { CognitiveDomain, Difficulty } from "@prisma/client";

import {
  getActiveGames,
  getCompletedScoredSessions,
  type SessionWithResult,
} from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import {
  buildDailyJourney,
  computeDomainPerformance,
  recommendDifficulty,
  HISTORY_WINDOW,
  STARTING_DIFFICULTY,
  type AvailableGame,
  type DifficultyRecommendation,
  type DomainPerformance,
  type JourneyActivity,
  type PerformanceSample,
} from "@/lib/cognitive-performance";

/**
 * The only part of the engine that touches the database. It reads a
 * person's real sessions, flattens them into the plain samples the
 * pure engine understands, and exposes the three things the app
 * needs: a next-difficulty for a game, a domain-by-domain picture for
 * the caregiver, and a personalised daily journey for the home screen.
 */

/** Flatten Prisma rows into engine samples. */
export function toSamples(sessions: SessionWithResult[]): PerformanceSample[] {
  return sessions
    .filter((s) => s.result !== null && s.completedAt !== null)
    .map((s) => {
      // Prefer the engine's own domain for the game; fall back to the
      // domain stored on the Game row for anything not in the registry.
      const domain = (getDefinition(s.gameId)?.domain ??
        s.game.domain) as CognitiveDomain;
      const result = s.result!;
      return {
        domain,
        difficulty: s.difficulty,
        score: result.score,
        accuracy: result.accuracy,
        mistakes: result.mistakes,
        hints: result.hints,
        roundsTotal: s.roundsTotal,
        avgResponseTimeMs: result.avgResponseTimeMs,
        completedAt: s.completedAt!,
      } satisfies PerformanceSample;
    });
}

/**
 * The adaptive difficulty for the next play of a game. This is the
 * server-side replacement for the Phase 1 `defaultDifficulty()`
 * lookup: it reads history rather than a static preference.
 */
export async function getRecommendedDifficulty(
  userId: string,
  gameId: string,
): Promise<Difficulty> {
  const domain = getDefinition(gameId)?.domain;
  if (!domain) return STARTING_DIFFICULTY;

  const samples = toSamples(await getCompletedScoredSessions(userId));
  const performance = computeDomainPerformance(domain, samples);
  return recommendDifficulty(performance).difficulty;
}

/**
 * The full recommendation (level + direction + reason) for a game's
 * domain, used by the result screen to pick an encouraging message.
 * Returns null for a game outside the registry.
 */
export async function getDifficultyRecommendation(
  userId: string,
  gameId: string,
): Promise<DifficultyRecommendation | null> {
  const domain = getDefinition(gameId)?.domain;
  if (!domain) return null;

  const samples = toSamples(await getCompletedScoredSessions(userId));
  const performance = computeDomainPerformance(domain, samples);
  return recommendDifficulty(performance);
}

export interface DomainProfile {
  performance: DomainPerformance;
  recommendation: DifficultyRecommendation;
  /** The game that exercises this domain, when one is active. */
  gameId: string | null;
  /** Windowed session scores, oldest→newest, for a small trend line. */
  recentScores: number[];
}

/** The windowed mastery scores for a domain, oldest→newest. */
function windowedScores(
  domain: CognitiveDomain,
  samples: PerformanceSample[],
): number[] {
  return samples
    .filter((s) => s.domain === domain)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
    .slice(0, HISTORY_WINDOW)
    .reverse()
    .map((s) => s.score);
}

/** The full per-domain picture the caregiver dashboard renders. */
export async function getCognitiveProfile(
  userId: string,
): Promise<DomainProfile[]> {
  const [games, sessions] = await Promise.all([
    getActiveGames(),
    getCompletedScoredSessions(userId),
  ]);
  const samples = toSamples(sessions);

  // One entry per active game's domain, in the games' display order.
  return games
    .map((game) => {
      const domain = (getDefinition(game.id)?.domain ??
        game.domain) as CognitiveDomain;
      const performance = computeDomainPerformance(domain, samples);
      return {
        performance,
        recommendation: recommendDifficulty(performance),
        gameId: game.id,
        recentScores: windowedScores(domain, samples),
      };
    });
}

/** The personalised "Today's Journey" for the home screen. */
export async function getDailyJourney(
  userId: string,
): Promise<JourneyActivity[]> {
  const [games, sessions] = await Promise.all([
    getActiveGames(),
    getCompletedScoredSessions(userId),
  ]);
  const samples = toSamples(sessions);

  const available: AvailableGame[] = games.map((game) => ({
    gameId: game.id,
    domain: (getDefinition(game.id)?.domain ??
      game.domain) as CognitiveDomain,
  }));

  const performanceByDomain = new Map<CognitiveDomain, DomainPerformance>();
  for (const game of available) {
    if (!performanceByDomain.has(game.domain)) {
      performanceByDomain.set(
        game.domain,
        computeDomainPerformance(game.domain, samples),
      );
    }
  }

  return buildDailyJourney(available, performanceByDomain);
}
