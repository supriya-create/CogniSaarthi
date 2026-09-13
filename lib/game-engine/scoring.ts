import type { ScoreSummary, SessionOutcome } from "@/lib/game-engine/types";

/**
 * Shared scoring. Every game funnels through this so a score means
 * the same thing everywhere in the app.
 *
 * The rule is deliberately plain: accuracy is correct answers over
 * possible answers, and the score is that as a percentage. Response
 * time and mistake counts are recorded but do NOT move the score in
 * Phase 1 — inventing a weighted formula would imply an insight the
 * product does not yet have.
 */

export function summarise(outcome: SessionOutcome): ScoreSummary {
  const rounds = outcome.rounds;

  const totalPossible = rounds.reduce((sum, r) => sum + r.total, 0);
  const correctCount = rounds.reduce((sum, r) => sum + r.correct, 0);
  const mistakes = rounds.reduce((sum, r) => sum + r.mistakes, 0);
  const hints = rounds.reduce((sum, r) => sum + r.hintsUsed, 0);
  const totalResponseTimeMs = rounds.reduce(
    (sum, r) => sum + r.responseTimeMs,
    0,
  );

  const accuracy = totalPossible > 0 ? correctCount / totalPossible : 0;

  return {
    score: Math.round(accuracy * 100),
    accuracy,
    stars: starsFor(accuracy),
    correctCount,
    incorrectCount: Math.max(0, totalPossible - correctCount),
    mistakes,
    hints,
    totalResponseTimeMs,
    avgResponseTimeMs:
      rounds.length > 0 ? Math.round(totalResponseTimeMs / rounds.length) : 0,
    roundsCompleted: rounds.length,
  };
}

/**
 * Stars are encouragement, not measurement. Finishing an activity
 * always earns at least one — nobody should be shown a zero.
 */
export function starsFor(accuracy: number): number {
  if (accuracy >= 1) return 5;
  if (accuracy >= 0.8) return 4;
  if (accuracy >= 0.6) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

export type ResultTone = "wonderful" | "wellDone" | "niceWork" | "goodTry";

export function toneFor(score: number): ResultTone {
  if (score >= 90) return "wonderful";
  if (score >= 75) return "wellDone";
  if (score >= 50) return "niceWork";
  return "goodTry";
}
