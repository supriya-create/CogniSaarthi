import { afterEach, describe, expect, it } from "vitest";

import { checkCopy, isSafeCopy, FORBIDDEN_PHRASES } from "@/lib/intelligence/safety";
import {
  aiAvailability,
  generateInsight,
  registerInsightProvider,
  toAiPayload,
  type InsightProvider,
} from "@/lib/intelligence/ai";
import {
  explainRecommendationForCaregiver,
  explainRoutine,
  explainTrend,
  trendClassLabel,
} from "@/lib/intelligence/explanations";
import { buildAllDomainProfiles, computeActivityRoutine } from "@/lib/intelligence/longitudinal";
import { rankActivities } from "@/lib/intelligence/recommendations";
import { toDomainFeatureVector } from "@/lib/intelligence/features";
import type { Insight } from "@/lib/intelligence/types";
import { NOW, series } from "@/lib/intelligence/__tests__/_helpers";

/**
 * The medical boundary and the optional AI layer. These are the tests
 * that stop Phase 6 turning a wellbeing product into something that
 * makes claims about a person's health.
 */

const DETERMINISTIC: Insight = {
  title: "Memory activities",
  explanation: "Performance has stayed about the same as the previous period.",
  suggestion: "A short memory activity today would keep the routine going.",
  confidence: "MEDIUM",
  source: "DETERMINISTIC",
};

afterEach(() => {
  registerInsightProvider(null); // never leak a provider between tests
});

// ---------------------------------------------------------------
// The boundary itself
// ---------------------------------------------------------------

describe("safety guard", () => {
  it("rejects diagnosis language", () => {
    for (const bad of [
      "This looks like early dementia.",
      "Signs of Alzheimer's disease.",
      "A diagnostic assessment is recommended.",
      "The patient shows cognitive impairment.",
      "Their brain health is deteriorating.",
      "Cognitive decline detected.",
      "They are at risk of further decline.",
    ]) {
      expect(isSafeCopy(bad), bad).toBe(false);
    }
  });

  it("allows the neutral wording the product actually uses", () => {
    for (const good of [
      "Memory activities have been more challenging recently.",
      "Your activity pattern has changed recently.",
      "They may benefit from more practice with memory activities.",
      "Performance in these activities has improved.",
      "Not enough recent activity to identify a trend.",
    ]) {
      expect(isSafeCopy(good), good).toBe(true);
    }
  });

  it("reports which phrase tripped it", () => {
    const result = checkCopy("Possible dementia and impairment.");
    expect(result.safe).toBe(false);
    expect(result.violations).toContain("dementia");
    expect(result.violations).toContain("impairment");
  });

  it("does not trip on innocent words containing a banned fragment", () => {
    expect(isSafeCopy("A unique and critique-free activity.")).toBe(true);
  });

  it("guards a meaningful list of phrases", () => {
    expect(FORBIDDEN_PHRASES.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------
// Every deterministic string the layer can emit
// ---------------------------------------------------------------

describe("all generated copy stays inside the boundary", () => {
  it("holds for trends, routines and recommendations across many histories", () => {
    const histories = [
      [],
      series("SHORT_TERM_MEMORY", [20, 25, 22, 18, 24], { startDaysAgo: 5 }),
      series("SHORT_TERM_MEMORY", [95, 20, 90, 25, 85], { startDaysAgo: 5 }),
      [
        ...series("SHORT_TERM_MEMORY", [88, 86, 90, 88], { startDaysAgo: 40, dayStep: 2 }),
        ...series("SHORT_TERM_MEMORY", [55, 52, 58, 54], { startDaysAgo: 14, dayStep: 3 }),
      ],
      series("ATTENTION", [70, 72], { startDaysAgo: 30 }),
    ];

    for (const samples of histories) {
      const profiles = buildAllDomainProfiles(samples, NOW);
      const routine = computeActivityRoutine(samples, NOW);

      expect(isSafeCopy(explainRoutine(routine))).toBe(true);

      for (const profile of profiles) {
        expect(isSafeCopy(explainTrend(profile)), explainTrend(profile)).toBe(true);
        expect(isSafeCopy(trendClassLabel(profile.trend))).toBe(true);
      }

      const ranked = rankActivities({
        profiles,
        routine,
        availableGames: [
          { gameId: "remember-objects", domain: "SHORT_TERM_MEMORY" },
          { gameId: "find-different", domain: "ATTENTION" },
        ],
        recentGameIds: [],
        completedTodayGameIds: [],
        difficultyByDomain: new Map(),
      });
      for (const recommendation of ranked) {
        const text = explainRecommendationForCaregiver(recommendation, "Test Activity");
        expect(isSafeCopy(text), text).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------
// AI layer
// ---------------------------------------------------------------

function provider(generate: InsightProvider["generate"]): InsightProvider {
  return { name: "test", generate };
}

describe("AI layer", () => {
  it("is unavailable by default — nothing is configured in this repo", () => {
    expect(aiAvailability()).toBe("AI_UNAVAILABLE");
  });

  it("falls back to the deterministic text when there is no provider", async () => {
    const result = await generateInsight(
      toAiPayload([], 0, 0),
      DETERMINISTIC,
    );
    expect(result.rejected).toBe("no_provider");
    expect(result.insight).toEqual(DETERMINISTIC);
    expect(result.insight.source).toBe("DETERMINISTIC");
  });

  it("uses a valid, safe response when one is offered", async () => {
    registerInsightProvider(
      provider(async () => ({
        title: "Steady progress",
        explanation: "Recent activities have been going consistently well.",
        suggestion: "Keep the routine going with a short activity today.",
        confidence: "MEDIUM",
      })),
    );
    expect(aiAvailability()).toBe("AI_AVAILABLE");

    const result = await generateInsight(toAiPayload([], 0, 0), DETERMINISTIC);
    expect(result.rejected).toBeUndefined();
    expect(result.insight.source).toBe("AI");
    expect(result.insight.title).toBe("Steady progress");
  });

  it("rejects malformed output", async () => {
    registerInsightProvider(provider(async () => ({ nonsense: true })));
    const result = await generateInsight(toAiPayload([], 0, 0), DETERMINISTIC);
    expect(result.rejected).toBe("invalid_output");
    expect(result.insight).toEqual(DETERMINISTIC);
  });

  it("rejects a model that makes a medical claim", async () => {
    registerInsightProvider(
      provider(async () => ({
        title: "Concerning pattern",
        explanation: "These results suggest early dementia.",
        suggestion: "Consult a doctor for a diagnosis.",
        confidence: "HIGH",
      })),
    );
    const result = await generateInsight(toAiPayload([], 0, 0), DETERMINISTIC);
    expect(result.rejected).toBe("unsafe_output");
    // The unsafe text never reaches the caller.
    expect(result.insight).toEqual(DETERMINISTIC);
  });

  it("survives a provider that throws", async () => {
    registerInsightProvider(
      provider(async () => {
        throw new Error("upstream exploded");
      }),
    );
    const result = await generateInsight(toAiPayload([], 0, 0), DETERMINISTIC);
    expect(result.rejected).toBe("provider_error");
    expect(result.insight).toEqual(DETERMINISTIC);
  });

  it("survives a provider that hangs", async () => {
    registerInsightProvider(provider(() => new Promise(() => {})));
    const result = await generateInsight(toAiPayload([], 0, 0), DETERMINISTIC);
    expect(result.rejected).toBe("timeout");
    expect(result.insight).toEqual(DETERMINISTIC);
  }, 10_000);

  it("will not let a model claim more confidence than the data supports", async () => {
    registerInsightProvider(
      provider(async () => ({
        title: "Definitely improving",
        explanation: "Activities are going well.",
        suggestion: "Keep going.",
        confidence: "HIGH",
      })),
    );
    const result = await generateInsight(toAiPayload([], 0, 0), {
      ...DETERMINISTIC,
      confidence: "LOW",
    });
    expect(result.insight.confidence).toBe("LOW");
  });
});

describe("AI payload carries no personal data", () => {
  it("contains only anonymised cognitive signals", () => {
    const samples = series("SHORT_TERM_MEMORY", [70, 75, 80], { startDaysAgo: 5 });
    const profiles = buildAllDomainProfiles(samples, NOW);
    const routine = computeActivityRoutine(samples, NOW);
    const payload = toAiPayload(
      profiles.map((p) => toDomainFeatureVector(p, routine)),
      routine.activitiesPerWeek,
      routine.activeDays,
    );

    const serialised = JSON.stringify(payload).toLowerCase();
    for (const forbidden of [
      "name",
      "supriya",
      "email",
      "phone",
      "token",
      "userid",
      "connectcode",
      "memory title",
      "note",
    ]) {
      expect(serialised, `payload leaked "${forbidden}"`).not.toContain(forbidden);
    }

    // Only the documented keys are present.
    expect(Object.keys(payload).sort()).toEqual([
      "activeDays",
      "activitiesPerWeek",
      "domains",
    ]);
  });
});
