import type { CognitiveDomain, Difficulty } from "@prisma/client";

import { masteryScore, sessionIndicator } from "@/lib/cognitive-performance/metrics";
import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import type {
  ActivityRoutine,
  LongitudinalDomainProfile,
} from "@/lib/intelligence/types";

/**
 * FEATURE REPRESENTATION (pure)
 * -----------------------------------------------------------------
 * A documented, stable description of what Cognisaarthi actually
 * measures — the shape a future model would train on, and the shape the
 * optional AI layer is allowed to see.
 *
 * NO MODEL IS TRAINED HERE. There is not remotely enough data for that,
 * and a model fitted to a handful of sessions would be a confident
 * liar. What exists is an honest feature contract, with each signal
 * labelled by how much it can currently be trusted:
 *
 *   RELIABLE     — directly measured, well populated, safe to use now.
 *   EXPERIMENTAL — measured but weakly informative or sparsely
 *                  populated; usable as a hint, never as a conclusion.
 *   UNAVAILABLE  — named so the gap is explicit rather than forgotten.
 */

export type FeatureReliability = "RELIABLE" | "EXPERIMENTAL" | "UNAVAILABLE";

export interface FeatureDescriptor {
  key: string;
  description: string;
  reliability: FeatureReliability;
  note?: string;
}

export const FEATURE_CATALOGUE: FeatureDescriptor[] = [
  {
    key: "accuracy",
    description: "Correct answers over possible answers in a session.",
    reliability: "RELIABLE",
  },
  {
    key: "difficulty",
    description: "The level played, chosen by the Phase 2 adaptive engine.",
    reliability: "RELIABLE",
  },
  {
    key: "indicator",
    description: "Accuracy placed in the band for the difficulty played.",
    reliability: "RELIABLE",
  },
  {
    key: "consistency",
    description: "Steadiness of recent scores in a domain.",
    reliability: "RELIABLE",
  },
  {
    key: "sessionFrequency",
    description: "Completed activities per week.",
    reliability: "RELIABLE",
  },
  {
    key: "trend",
    description: "Direction of the indicator between windows.",
    reliability: "RELIABLE",
  },
  {
    key: "hintRate",
    description: "Hints used per round.",
    reliability: "EXPERIMENTAL",
    note: "Not every activity offers hints, so a zero can mean 'did not need one' or 'none available'. Weak on its own.",
  },
  {
    key: "responseTime",
    description: "Average response time per round, in ms.",
    reliability: "EXPERIMENTAL",
    note: "Originates on the device and is 0 when unknown. Phase 2 deliberately lets it move a score only slightly — an older adult taking their time is not doing worse.",
  },
  {
    key: "completionRate",
    description: "Completed sessions over sessions started.",
    reliability: "EXPERIMENTAL",
    note: "Requires abandoned sessions, which exist but are sparse. Since Phase 5 an activity can also start offline, so the started/finished pair is not always both present.",
  },
  {
    key: "timeOfDay",
    description: "When in the day activities are usually done.",
    reliability: "UNAVAILABLE",
    note: "Recorded, but far too few sessions per person to say anything responsible about it yet.",
  },
  {
    key: "fatigue",
    description: "A genuine fatigue measure.",
    reliability: "UNAVAILABLE",
    note: "Cannot be measured from gameplay. Effort SIGNALS (hint leaning, a run of low scores) are used to soften a suggestion, and are never called fatigue.",
  },
];

/** One session, reduced to its features. */
export interface SessionFeatures {
  domain: CognitiveDomain;
  difficulty: Difficulty;
  accuracy: number;
  indicator: number;
  mastery: number;
  hintRate: number;
  responseTimeMs: number;
  completedAt: Date;
}

export function extractSessionFeatures(
  sample: PerformanceSample,
): SessionFeatures {
  return {
    domain: sample.domain,
    difficulty: sample.difficulty,
    accuracy: sample.accuracy,
    indicator: sessionIndicator(sample),
    mastery: masteryScore(sample),
    hintRate:
      sample.roundsTotal > 0 ? sample.hints / sample.roundsTotal : 0,
    responseTimeMs: sample.avgResponseTimeMs,
    completedAt: sample.completedAt,
  };
}

/**
 * The per-domain vector an external model — or the optional AI
 * explanation layer — would receive. Deliberately contains NO identity:
 * no name, no id, no free text, nothing about memories or contacts.
 */
export interface DomainFeatureVector {
  domain: CognitiveDomain;
  activityCount: number;
  recentPerformance: number | null;
  longTermPerformance: number | null;
  consistency: number | null;
  trend: string;
  confidence: string;
  activitiesPerWeek: number;
}

export function toDomainFeatureVector(
  profile: LongitudinalDomainProfile,
  routine: ActivityRoutine,
): DomainFeatureVector {
  return {
    domain: profile.domain,
    activityCount: profile.activityCount,
    recentPerformance: profile.recentPerformance,
    longTermPerformance: profile.longTermPerformance,
    consistency: profile.consistency,
    trend: profile.trend.classification,
    confidence: profile.confidence,
    activitiesPerWeek: routine.activitiesPerWeek,
  };
}
