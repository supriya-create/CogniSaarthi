import type { CognitiveDomain, Difficulty } from "@prisma/client";

/**
 * A single completed session, flattened to just the fields the
 * performance engine needs. The engine works entirely on arrays of
 * these — never on Prisma rows — so all of it is pure and testable
 * without a database. `toSamples()` in the adapter builds them.
 */
export interface PerformanceSample {
  domain: CognitiveDomain;
  difficulty: Difficulty;
  /** 0–100, the accuracy percentage recorded for the session. */
  score: number;
  /** 0–1. */
  accuracy: number;
  mistakes: number;
  hints: number;
  roundsTotal: number;
  /** Average response time per round in ms; 0 when unknown. */
  avgResponseTimeMs: number;
  /** When the session completed — used for ordering only. */
  completedAt: Date;
}

export type Trend = "improving" | "stable" | "declining";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type StepDirection = "up" | "down" | "hold";

/** A reason code, so UI copy is chosen by the presentation layer and
 *  never hard-coded (and never leaks internal wording to the elder). */
export type RecommendationReason =
  | "coldStart"
  | "steppedUpStrong"
  | "steppedUpImproving"
  | "steppedDown"
  | "held"
  | "heldUnstable"
  | "atMaximum"
  | "atMinimum";

/** The performance picture for one cognitive domain. */
export interface DomainPerformance {
  domain: CognitiveDomain;
  /** Completed sessions considered (already limited to the window). */
  sessionCount: number;
  /** True when there is not yet enough data to personalise. */
  coldStart: boolean;
  /** 0–100 ability indicator; null in cold start. */
  indicator: number | null;
  /** 0–100 mastery of the level currently being played; null cold. */
  mastery: number | null;
  /** 0–100 stability of recent scores; null with < 2 sessions. */
  consistency: number | null;
  trend: Trend;
  confidence: Confidence;
  /** The difficulty of the most recent session, or the start level. */
  currentDifficulty: Difficulty;
}

export interface DifficultyRecommendation {
  domain: CognitiveDomain;
  difficulty: Difficulty;
  previousDifficulty: Difficulty;
  direction: StepDirection;
  reason: RecommendationReason;
  confidence: Confidence;
}

/** One activity in the personalised daily journey. */
export interface JourneyActivity {
  gameId: string;
  domain: CognitiveDomain;
  difficulty: Difficulty;
  estimatedMinutes: number;
  /** Why this activity is placed here, as a reason code. */
  reason: "needsPractice" | "keepSteady" | "forEnjoyment";
  /** Lower = earlier in the day (weaker domains lead). */
  rank: number;
}
