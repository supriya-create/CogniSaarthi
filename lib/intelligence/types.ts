import type { CognitiveDomain, Difficulty } from "@prisma/client";

import type { Confidence, Trend } from "@/lib/cognitive-performance/types";

/**
 * ADVANCED COGNITIVE INTELLIGENCE — shared types.
 * -----------------------------------------------------------------
 * This layer sits ON TOP of the Phase 2 performance engine. It does not
 * re-score anything: Phase 2 remains the single source of "how did that
 * session go", and everything here is about the longer arc — baselines,
 * windows, balance and what to suggest next.
 *
 * Nothing in this layer is a medical measurement. Every value describes
 * ACTIVITY (how the exercises went), never a faculty or a diagnosis.
 */

// ---------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------

export type BaselineState = "NOT_ESTABLISHED" | "ESTABLISHED";

export interface DomainBaseline {
  domain: CognitiveDomain;
  state: BaselineState;
  /** Sessions that counted towards the baseline. */
  sessionCount: number;
  /** 0–100 reference level, using the Phase 2 indicator. Null if unset. */
  level: number | null;
  /** 0–100 steadiness of the baseline period. Null with too few. */
  consistency: number | null;
  establishedAt: Date | null;
}

// ---------------------------------------------------------------
// Trends
// ---------------------------------------------------------------

/**
 * Phase 2's `Trend` is improving/stable/declining. The longitudinal
 * layer needs two more honest answers: results that swing too much to
 * call, and not enough data to say anything at all.
 */
export type TrendClass =
  | "IMPROVING"
  | "STABLE"
  | "DECLINING"
  | "VARIABLE"
  | "INSUFFICIENT_DATA";

export type TrendHorizon = "SHORT" | "MEDIUM" | "LONG";

export interface TrendReading {
  horizon: TrendHorizon;
  classification: TrendClass;
  /** Indicator over the recent window, 0–100. Null when unknown. */
  current: number | null;
  /** Indicator over the window before it, 0–100. Null when unknown. */
  previous: number | null;
  /** current − previous, when both are known. */
  delta: number | null;
  sessionCount: number;
  confidence: Confidence;
}

// ---------------------------------------------------------------
// Longitudinal profile
// ---------------------------------------------------------------

/**
 * The long-arc picture for one domain. Named to avoid colliding with
 * Phase 2's existing `DomainProfile` (lib/cognitive-performance/profile),
 * which is the short-window view this builds upon.
 */
export interface LongitudinalDomainProfile {
  domain: CognitiveDomain;
  /** 0–100 mastery at the level currently played (Phase 2). Null cold. */
  mastery: number | null;
  /** Ability indicator over the recent window. Null cold. */
  recentPerformance: number | null;
  /** Ability indicator over all available history. Null cold. */
  longTermPerformance: number | null;
  consistency: number | null;
  /** Phase 2's short-window trend, kept so the two never disagree. */
  shortTrend: Trend;
  /** The longitudinal reading, which may be VARIABLE / INSUFFICIENT. */
  trend: TrendReading;
  confidence: Confidence;
  baseline: DomainBaseline;
  activityCount: number;
  lastActivityAt: Date | null;
  currentDifficulty: Difficulty;
}

// ---------------------------------------------------------------
// Activity regularity (explicitly NOT a health score)
// ---------------------------------------------------------------

export interface ActivityRoutine {
  /** Distinct local days with a completed activity, in the window. */
  activeDays: number;
  daysInWindow: number;
  activitiesPerWeek: number;
  /** 0–100 share of days active. A routine measure, nothing more. */
  routineConsistency: number;
  /** Whole days since the last completed activity; null if never. */
  daysSinceLastActivity: number | null;
  totalActivities: number;
}

// ---------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------

/**
 * Why an activity was chosen. Reason CODES, so the presentation layer
 * decides the wording and the elder never sees engine vocabulary.
 */
export type RecommendationReasonCode =
  | "needsPractice"
  | "buildOnSuccess"
  | "forVariety"
  | "notPlayedRecently"
  | "preferred"
  | "gentleReturn"
  | "keepSteady"
  | "coldStart";

export interface ActivityRecommendation {
  gameId: string;
  domain: CognitiveDomain;
  difficulty: Difficulty;
  estimatedMinutes: number;
  /** Ordering weight; higher is a stronger suggestion. */
  score: number;
  /** Every reason that contributed, strongest first. */
  reasons: RecommendationReasonCode[];
  primaryReason: RecommendationReasonCode;
  confidence: Confidence;
}

// ---------------------------------------------------------------
// Daily plan
// ---------------------------------------------------------------

export type PlanShape = "SHORT" | "NORMAL";

export interface DailyPlan {
  shape: PlanShape;
  /** What to do next, in order. Excludes anything already done today. */
  activities: ActivityRecommendation[];
  /** An optional extra, never presented as required. */
  optionalExtra: ActivityRecommendation | null;
  completedToday: number;
  /** True when the day's suggested activities are all done. */
  complete: boolean;
  /** Softer plan because recent sessions looked effortful. */
  gentler: boolean;
}

// ---------------------------------------------------------------
// Explanations & insights
// ---------------------------------------------------------------

export type InsightSource = "DETERMINISTIC" | "AI";

export interface Insight {
  title: string;
  explanation: string;
  suggestion: string;
  confidence: Confidence;
  /** Which layer produced the text. Always reported honestly. */
  source: InsightSource;
}
