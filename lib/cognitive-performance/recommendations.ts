import type { CognitiveDomain } from "@prisma/client";

import { ESTIMATED_MINUTES_PER_ACTIVITY } from "@/lib/cognitive-performance/config";
import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import type {
  DifficultyRecommendation,
  DomainPerformance,
  JourneyActivity,
  Trend,
} from "@/lib/cognitive-performance/types";

/**
 * From performance to a plan. This module decides which activities to
 * suggest and in what order, and turns the engine's reason codes into
 * language for people — encouraging for the elder, neutral and
 * explanatory for the caregiver. It never diagnoses and never exposes
 * the internal machinery ("difficulty raised from 2 to 3") to the
 * person playing.
 */

export interface AvailableGame {
  gameId: string;
  domain: CognitiveDomain;
}

/**
 * Rank domains weakest-first so the day leads with practice where it
 * helps most. A domain with no data yet is treated as mid-pack: worth
 * playing to learn about, but not urgent.
 */
export function rankDomainsWeakestFirst(
  performances: DomainPerformance[],
): DomainPerformance[] {
  const rankValue = (p: DomainPerformance) =>
    p.indicator ?? 55; // cold-start neutral midpoint
  return [...performances].sort((a, b) => rankValue(a) - rankValue(b));
}

/**
 * Build the personalised daily journey.
 *
 * Weaker domains lead, but every domain is included — never only
 * drilling the weakest. With more games per domain later, the same
 * ordering yields a challenge/confidence/variety mix; with Phase 1's
 * one-game-per-domain it orders the three from weakest to strongest.
 */
export function buildDailyJourney(
  games: AvailableGame[],
  performanceByDomain: Map<CognitiveDomain, DomainPerformance>,
): JourneyActivity[] {
  const withPerf = games
    .map((game) => ({
      game,
      perf: performanceByDomain.get(game.domain),
    }))
    .filter(
      (entry): entry is { game: AvailableGame; perf: DomainPerformance } =>
        entry.perf !== undefined,
    );

  const ordered = withPerf.sort((a, b) => {
    const av = a.perf.indicator ?? 55;
    const bv = b.perf.indicator ?? 55;
    return av - bv;
  });

  const total = ordered.length;
  return ordered.map((entry, index) => {
    const recommendation = recommendDifficulty(entry.perf);
    return {
      gameId: entry.game.gameId,
      domain: entry.game.domain,
      difficulty: recommendation.difficulty,
      estimatedMinutes: ESTIMATED_MINUTES_PER_ACTIVITY,
      reason: journeyReason(index, total),
      rank: index,
    };
  });
}

function journeyReason(index: number, total: number): JourneyActivity["reason"] {
  if (total <= 1) return "keepSteady";
  if (index === 0) return "needsPractice";
  if (index === total - 1) return "forEnjoyment";
  return "keepSteady";
}

// -----------------------------------------------------------------
// Elder-facing result message (returns a reason code; the page maps
// it to localised copy so no wording is hard-coded here).
// -----------------------------------------------------------------

export type ResultMessageKey =
  | "resultMsgSteppedUp"
  | "resultMsgStrong"
  | "resultMsgSteady"
  | "resultMsgGentle";

export function resultMessageKey(params: {
  score: number;
  direction: DifficultyRecommendation["direction"];
  reason: DifficultyRecommendation["reason"];
}): ResultMessageKey {
  if (params.direction === "up") return "resultMsgSteppedUp";
  if (params.score >= 85) return "resultMsgStrong";
  if (params.score >= 60) return "resultMsgSteady";
  return "resultMsgGentle";
}

// -----------------------------------------------------------------
// Caregiver-facing prose. The caregiver interface is English in
// Phase 1, so these return finished English sentences. Every one is
// neutral and non-clinical by construction.
// -----------------------------------------------------------------

export function trendLabel(trend: Trend): string {
  return {
    improving: "Improving",
    stable: "Stable",
    declining: "Needs more practice",
  }[trend];
}

const DOMAIN_WORD: Record<CognitiveDomain, string> = {
  SHORT_TERM_MEMORY: "memory",
  ATTENTION: "attention",
  WORKING_MEMORY: "working memory",
  LANGUAGE: "language",
  PROCESSING_SPEED: "processing speed",
  EXECUTIVE_FUNCTION: "planning",
};

const DIFFICULTY_WORD = { EASY: "easier", MEDIUM: "medium", HARD: "harder" };

/**
 * One plain sentence explaining why an activity was suggested at the
 * level it was — the transparency the caregiver section promises.
 */
export function explainRecommendation(rec: DifficultyRecommendation): string {
  const domain = DOMAIN_WORD[rec.domain];

  switch (rec.reason) {
    case "coldStart":
      return `Starting ${domain} activities at an easier level while Cognisaarthi learns how they go.`;
    case "steppedUpStrong":
      return `Recent ${domain} activities have been going well and steadily, so the next one is a little more challenging.`;
    case "steppedUpImproving":
      return `${capitalise(domain)} has been improving over recent activities, so the next one steps up gently.`;
    case "steppedDown":
      return `Recent ${domain} activities have been a bit challenging, so the next one is set a little easier.`;
    case "heldUnstable":
      return `${capitalise(domain)} results have varied recently, so the level is kept the same for now rather than moved up.`;
    case "atMaximum":
      return `${capitalise(domain)} is going well at the most challenging level, so it stays there.`;
    case "atMinimum":
      return `${capitalise(domain)} is kept at the gentlest level for now.`;
    case "held":
    default:
      return `${capitalise(domain)} is steady, so the level stays the same for the next activity.`;
  }
}

/** A one-line summary of how a domain is going, for the caregiver. */
export function summariseDomain(perf: DomainPerformance): string {
  if (perf.coldStart) {
    const remaining = Math.max(0, 3 - perf.sessionCount);
    return remaining > 0
      ? `A few more activities (about ${remaining}) will let Cognisaarthi personalise this area.`
      : "Building up a picture of this area.";
  }
  return `${trendLabel(perf.trend)} · at the ${DIFFICULTY_WORD[perf.currentDifficulty]} level`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
