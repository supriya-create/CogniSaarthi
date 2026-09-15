import type { CognitiveDomain, Difficulty } from "@prisma/client";

import { ESTIMATED_MINUTES_PER_ACTIVITY } from "@/lib/cognitive-performance/config";
import type { Confidence } from "@/lib/cognitive-performance/types";
import {
  PENALTY_DOMAIN_REPEAT,
  PENALTY_JUST_PLAYED,
  RETURNING_AFTER_DAYS,
  WEAKNESS_ABSOLUTE_FROM,
  WEAKNESS_ABSOLUTE_MAX,
  WEAKNESS_DEFICIT_POINTS,
  WEAKNESS_UNKNOWN_DOMAIN,
  WEIGHT_BUILD_ON_SUCCESS,
  WEIGHT_NEEDS_PRACTICE,
  WEIGHT_NEW_DOMAIN,
  WEIGHT_NOT_PLAYED_RECENTLY,
  WEIGHT_PREFERRED,
  WEIGHT_VARIETY,
} from "@/lib/intelligence/config";
import type {
  ActivityRecommendation,
  ActivityRoutine,
  LongitudinalDomainProfile,
  RecommendationReasonCode,
} from "@/lib/intelligence/types";

/**
 * THE RECOMMENDATION ENGINE (pure, transparent, no model)
 * -----------------------------------------------------------------
 * Answers "what should this person do next?" as a small weighted sum
 * whose every term can be explained in one sentence. There is no
 * black box: the reasons that moved a score are carried on the result,
 * which is what makes the caregiver explanation honest rather than
 * reverse-engineered.
 *
 * The single most important behaviour here is that it does NOT simply
 * hand back the weakest domain every day. Drilling somebody on the
 * thing they are worst at, every morning, is how you get an older adult
 * to quietly stop opening the app. Practice need leads, but recency,
 * variety and a bit of earned success all pull against it.
 */

/** Neutral midpoint for a domain with no data — neither weak nor strong. */
const NEUTRAL_PERFORMANCE = 55;

export interface CandidateGame {
  gameId: string;
  domain: CognitiveDomain;
}

export interface RecommendationContext {
  profiles: LongitudinalDomainProfile[];
  routine: ActivityRoutine;
  availableGames: CandidateGame[];
  /** Recently played activities, most recent first. */
  recentGameIds: string[];
  /** Activities already completed today — excluded from suggestions. */
  completedTodayGameIds: string[];
  /** The level Phase 2 would open each domain at. */
  difficultyByDomain: Map<CognitiveDomain, Difficulty>;
  /** Activities the person plays most; a gentle nudge, not a rule. */
  preferredGameIds?: string[];
}

/** A candidate mid-ranking; `score` is mutated by `diversify`. */
type ScoredCandidate = ActivityRecommendation;

/**
 * Rank every available activity. Returns all candidates in order, so a
 * caller can take as many as a plan needs.
 */
export function rankActivities(
  context: RecommendationContext,
): ActivityRecommendation[] {
  const profileByDomain = new Map(
    context.profiles.map((profile) => [profile.domain, profile]),
  );
  const justPlayed = context.recentGameIds[0] ?? null;
  const recentSet = new Set(context.recentGameIds.slice(0, 3));
  const preferred = new Set(context.preferredGameIds ?? []);

  const returning =
    context.routine.daysSinceLastActivity !== null &&
    context.routine.daysSinceLastActivity >= RETURNING_AFTER_DAYS;

  // The person's own average across the domains they actually play.
  // Practice need is judged against THIS, not an absolute scale.
  const known = context.profiles
    .map((profile) => profile.recentPerformance)
    .filter((value): value is number => value !== null);
  const personalMean =
    known.length > 0
      ? known.reduce((sum, value) => sum + value, 0) / known.length
      : NEUTRAL_PERFORMANCE;

  const scored: ScoredCandidate[] = context.availableGames.map((game) => {
    const profile = profileByDomain.get(game.domain);
    const reasons: { code: RecommendationReasonCode; weight: number }[] = [];

    // --- Practice need -------------------------------------------------
    const weakness = weaknessOf(profile?.recentPerformance ?? null, personalMean);
    reasons.push({
      code: "needsPractice",
      weight: weakness * WEIGHT_NEEDS_PRACTICE,
    });

    // --- Not played for a while, or not played at all -------------------
    // These are different things. A practised domain gone quiet is
    // overdue; one never opened is merely worth introducing, and must
    // not outrank something the person visibly finds hard.
    const daysSince = profile?.lastActivityAt
      ? daysBetween(profile.lastActivityAt, new Date())
      : null;
    if (daysSince === null) {
      reasons.push({ code: "forVariety", weight: WEIGHT_NEW_DOMAIN });
    } else if (daysSince >= 3) {
      reasons.push({
        code: "notPlayedRecently",
        weight: WEIGHT_NOT_PLAYED_RECENTLY,
      });
    }

    // --- Variety --------------------------------------------------------
    if (!recentSet.has(game.gameId)) {
      reasons.push({ code: "forVariety", weight: WEIGHT_VARIETY });
    }

    // --- Earned success -------------------------------------------------
    // Something they have been doing well keeps the day encouraging.
    if (profile && profile.shortTrend === "improving") {
      reasons.push({
        code: "buildOnSuccess",
        weight: WEIGHT_BUILD_ON_SUCCESS,
      });
    }

    // --- Preference -----------------------------------------------------
    if (preferred.has(game.gameId)) {
      reasons.push({ code: "preferred", weight: WEIGHT_PREFERRED });
    }

    let score = reasons.reduce((sum, reason) => sum + reason.weight, 0);

    // --- Anti-repetition -------------------------------------------------
    if (justPlayed === game.gameId) score -= PENALTY_JUST_PLAYED;

    const coldStart =
      !profile || profile.baseline.state === "NOT_ESTABLISHED";

    const ordered = [...reasons].sort((a, b) => b.weight - a.weight);
    const reasonCodes = ordered
      .filter((reason) => reason.weight > 0)
      .map((reason) => reason.code);

    const primaryReason: RecommendationReasonCode = returning
      ? "gentleReturn"
      : coldStart
        ? "coldStart"
        : (reasonCodes[0] ?? "keepSteady");

    return {
      gameId: game.gameId,
      domain: game.domain,
      difficulty: context.difficultyByDomain.get(game.domain) ?? "EASY",
      estimatedMinutes: ESTIMATED_MINUTES_PER_ACTIVITY,
      score,
      reasons: reasonCodes,
      primaryReason,
      confidence: profile?.confidence ?? ("LOW" as Confidence),
    };
  });

  // Completed today drops out entirely — never suggest what is done.
  const done = new Set(context.completedTodayGameIds);
  const remaining = scored.filter((c) => !done.has(c.gameId));

  return diversify(remaining);
}

/**
 * Order by score, but never let one domain take consecutive slots while
 * another domain is still unrepresented. This is what turns a ranked
 * list into a balanced DAY rather than three variations of the same
 * exercise.
 */
function diversify(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const picked: ScoredCandidate[] = [];
  const usedDomains = new Set<CognitiveDomain>();

  while (pool.length > 0) {
    // Prefer the best candidate from a domain not yet used.
    let index = pool.findIndex((c) => !usedDomains.has(c.domain));
    if (index === -1) index = 0; // every domain used: fall back to score

    const [next] = pool.splice(index, 1);
    // A repeated domain is still allowed, just pushed down the order.
    if (usedDomains.has(next.domain)) next.score -= PENALTY_DOMAIN_REPEAT;
    usedDomains.add(next.domain);
    picked.push(next);
  }

  return picked;
}

/**
 * How much practice a domain needs, 0–1.
 *
 * Primarily RELATIVE: how far below the person's own average this
 * domain sits. That is what "weak" actually means for an individual —
 * someone who scores 85 everywhere and 60 here needs practice here,
 * even though 60 is not a low number.
 *
 * The absolute floor stops a uniformly struggling person from being
 * told nothing needs practice: if every domain is equally low there is
 * no relative deficit, but the practice is still worth doing.
 */
function weaknessOf(
  performance: number | null,
  personalMean: number,
): number {
  if (performance === null) return WEAKNESS_UNKNOWN_DOMAIN;

  const relative = clamp01(
    (personalMean - performance) / WEAKNESS_DEFICIT_POINTS,
  );
  const absolute = Math.min(
    WEAKNESS_ABSOLUTE_MAX,
    clamp01((WEAKNESS_ABSOLUTE_FROM - performance) / WEAKNESS_ABSOLUTE_FROM),
  );
  return Math.max(relative, absolute);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}
