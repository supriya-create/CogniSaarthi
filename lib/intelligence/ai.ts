import { z } from "zod";

import type { Confidence } from "@/lib/cognitive-performance/types";
import type { DomainFeatureVector } from "@/lib/intelligence/features";
import { checkAllCopy } from "@/lib/intelligence/safety";
import type { Insight } from "@/lib/intelligence/types";

/**
 * THE OPTIONAL AI LAYER
 * -----------------------------------------------------------------
 * State of play, stated plainly: **no LLM provider is configured in
 * this repository**. There is no API key, no SDK, no vendor client —
 * `.env` holds a database URL and an auth secret and nothing else. So
 * in the shipped application this module always reports AI_UNAVAILABLE
 * and every explanation you see is the deterministic one.
 *
 * That is deliberate, not unfinished. The rules this layer obeys:
 *
 *  1. The product works fully without it. The deterministic engine
 *     produces every insight; AI may only REPHRASE one.
 *  2. It never calculates anything. No trend, no score, no conclusion
 *     comes from a model — only wording.
 *  3. Output is validated with Zod AND run through the medical-safety
 *     guard. A model that volunteers "this looks like early dementia"
 *     is discarded, not displayed.
 *  4. Any failure — no provider, a timeout, malformed JSON, unsafe
 *     copy — silently falls back to the deterministic text. An elderly
 *     user never sees an AI error, because they never needed to know
 *     an AI was involved.
 *  5. Only minimal, anonymised, structured signals are ever sent. See
 *     `toAiPayload`.
 */

export type AiAvailability = "AI_AVAILABLE" | "AI_UNAVAILABLE";

/** How long a provider gets before we give up and use our own words. */
const AI_TIMEOUT_MS = 4_000;

/** The shape any future provider must satisfy. */
export interface InsightProvider {
  name: string;
  generate(payload: AiPayload): Promise<unknown>;
}

/**
 * The ONLY thing sent to a provider: anonymised, structured, cognitive
 * activity signals. No name, no user id, no free text, no memories, no
 * contacts, no caregiver notes, no reminders — nothing that could
 * identify a person or reveal their private life.
 */
export interface AiPayload {
  domains: DomainFeatureVector[];
  activitiesPerWeek: number;
  activeDays: number;
}

export function toAiPayload(
  domains: DomainFeatureVector[],
  activitiesPerWeek: number,
  activeDays: number,
): AiPayload {
  return {
    // Rebuilt field by field, so a future addition to the feature
    // vector cannot silently start leaking something personal.
    domains: domains.map((d) => ({
      domain: d.domain,
      activityCount: d.activityCount,
      recentPerformance: d.recentPerformance,
      longTermPerformance: d.longTermPerformance,
      consistency: d.consistency,
      trend: d.trend,
      confidence: d.confidence,
      activitiesPerWeek: d.activitiesPerWeek,
    })),
    activitiesPerWeek,
    activeDays,
  };
}

// -----------------------------------------------------------------
// Provider registry — empty by default
// -----------------------------------------------------------------

let provider: InsightProvider | null = null;

/** Register a provider. Nothing in the repository calls this today. */
export function registerInsightProvider(next: InsightProvider | null): void {
  provider = next;
}

export function aiAvailability(): AiAvailability {
  return provider ? "AI_AVAILABLE" : "AI_UNAVAILABLE";
}

// -----------------------------------------------------------------
// Output contract
// -----------------------------------------------------------------

/** Raw model output is never trusted or rendered directly. */
export const aiInsightSchema = z.object({
  title: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(1).max(400),
  suggestion: z.string().trim().min(1).max(200),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export type AiInsight = z.infer<typeof aiInsightSchema>;

/** Why a generation attempt did not produce usable text. */
export type AiRejectionReason =
  | "no_provider"
  | "timeout"
  | "provider_error"
  | "invalid_output"
  | "unsafe_output";

export interface GenerateResult {
  insight: Insight;
  /** Present when the deterministic text was used instead. */
  rejected?: AiRejectionReason;
}

/**
 * Produce a human-friendly insight.
 *
 * `deterministic` is the answer the engine already computed and is what
 * gets returned unless a provider offers something demonstrably valid
 * and safe. Callers therefore always receive usable text.
 */
export async function generateInsight(
  payload: AiPayload,
  deterministic: Insight,
): Promise<GenerateResult> {
  if (!provider) {
    return { insight: deterministic, rejected: "no_provider" };
  }

  let raw: unknown;
  try {
    raw = await withTimeout(provider.generate(payload), AI_TIMEOUT_MS);
  } catch (error) {
    return {
      insight: deterministic,
      rejected: error instanceof TimeoutError ? "timeout" : "provider_error",
    };
  }

  const parsed = aiInsightSchema.safeParse(raw);
  if (!parsed.success) {
    return { insight: deterministic, rejected: "invalid_output" };
  }

  // The safety guard applies to model output exactly as it does to our
  // own copy — arguably more so.
  const safety = checkAllCopy([
    parsed.data.title,
    parsed.data.explanation,
    parsed.data.suggestion,
  ]);
  if (!safety.safe) {
    return { insight: deterministic, rejected: "unsafe_output" };
  }

  return {
    insight: {
      title: parsed.data.title,
      explanation: parsed.data.explanation,
      suggestion: parsed.data.suggestion,
      // Never let a model inflate its own certainty above what the data
      // supports: the engine's confidence caps it.
      confidence: capConfidence(parsed.data.confidence, deterministic.confidence),
      source: "AI",
    },
  };
}

const ORDER: Confidence[] = ["LOW", "MEDIUM", "HIGH"];

function capConfidence(claimed: Confidence, ceiling: Confidence): Confidence {
  return ORDER.indexOf(claimed) > ORDER.indexOf(ceiling) ? ceiling : claimed;
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("ai_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
