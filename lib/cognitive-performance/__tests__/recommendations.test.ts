import { describe, expect, it } from "vitest";
import type { CognitiveDomain } from "@prisma/client";

import {
  buildDailyJourney,
  explainRecommendation,
  rankDomainsWeakestFirst,
  resultMessageKey,
  summariseDomain,
  trendLabel,
  type AvailableGame,
} from "@/lib/cognitive-performance/recommendations";
import { recommendDifficulty } from "@/lib/cognitive-performance/difficulty";
import { computeDomainPerformance } from "@/lib/cognitive-performance/performance";
import type { DomainPerformance } from "@/lib/cognitive-performance/types";
import { runOfScores } from "./_helpers";

const GAMES: AvailableGame[] = [
  { gameId: "remember-objects", domain: "SHORT_TERM_MEMORY" },
  { gameId: "find-different", domain: "ATTENTION" },
  { gameId: "remember-sequence", domain: "WORKING_MEMORY" },
];

function domainPerf(
  domain: CognitiveDomain,
  scores: number[],
): DomainPerformance {
  return computeDomainPerformance(domain, runOfScores(scores, { domain }));
}

describe("weakest-first ordering", () => {
  it("puts the lower-performing domain first", () => {
    const strong = domainPerf("ATTENTION", [95, 95, 95, 95, 95]);
    const weak = domainPerf("SHORT_TERM_MEMORY", [40, 45, 42, 44, 41]);
    const ranked = rankDomainsWeakestFirst([strong, weak]);
    expect(ranked[0].domain).toBe("SHORT_TERM_MEMORY");
  });
});

describe("daily journey", () => {
  it("includes every domain, weakest first, with a difficulty each", () => {
    const perfByDomain = new Map<CognitiveDomain, DomainPerformance>([
      ["SHORT_TERM_MEMORY", domainPerf("SHORT_TERM_MEMORY", [40, 45, 42, 44, 41])],
      ["ATTENTION", domainPerf("ATTENTION", [95, 95, 95, 95, 95])],
      ["WORKING_MEMORY", domainPerf("WORKING_MEMORY", [70, 72, 71, 73, 70])],
    ]);

    const journey = buildDailyJourney(GAMES, perfByDomain);

    expect(journey).toHaveLength(3);
    expect(journey[0].domain).toBe("SHORT_TERM_MEMORY"); // weakest leads
    expect(journey[0].reason).toBe("needsPractice");
    expect(journey[journey.length - 1].reason).toBe("forEnjoyment");
    expect(journey.every((a) => ["EASY", "MEDIUM", "HARD"].includes(a.difficulty)))
      .toBe(true);
    // ranks are contiguous from 0
    expect(journey.map((a) => a.rank)).toEqual([0, 1, 2]);
  });

  it("still produces a full journey for a brand-new user (cold start)", () => {
    const empty = new Map<CognitiveDomain, DomainPerformance>(
      GAMES.map((g) => [g.domain, domainPerf(g.domain, [])]),
    );
    const journey = buildDailyJourney(GAMES, empty);
    expect(journey).toHaveLength(3);
    expect(journey.every((a) => a.difficulty === "EASY")).toBe(true);
  });
});

describe("result message key", () => {
  it("celebrates a step up", () => {
    expect(
      resultMessageKey({ score: 90, direction: "up", reason: "steppedUpStrong" }),
    ).toBe("resultMsgSteppedUp");
  });

  it("is gentle after a low score", () => {
    expect(
      resultMessageKey({ score: 40, direction: "hold", reason: "held" }),
    ).toBe("resultMsgGentle");
  });

  it("acknowledges a strong hold", () => {
    expect(
      resultMessageKey({ score: 92, direction: "hold", reason: "atMaximum" }),
    ).toBe("resultMsgStrong");
  });
});

describe("caregiver copy is neutral and non-clinical", () => {
  const FORBIDDEN = [
    "dementia",
    "diagnos",
    "disease",
    "cognitive impairment",
    "decline",
    "disorder",
    "patient",
  ];

  it("trend labels avoid medical language", () => {
    expect(trendLabel("declining")).toBe("Needs more practice");
    expect(trendLabel("improving")).toBe("Improving");
    expect(trendLabel("stable")).toBe("Stable");
  });

  it("explanations never use clinical terms", () => {
    const scenarios = [
      domainPerf("SHORT_TERM_MEMORY", [90, 92, 94, 95, 96]),
      domainPerf("ATTENTION", [40, 45, 42, 44, 41]),
      domainPerf("WORKING_MEMORY", [55, 61, 68, 74, 81]),
      domainPerf("SHORT_TERM_MEMORY", [95, 45, 88, 50, 92]),
      domainPerf("ATTENTION", []),
    ];
    for (const perf of scenarios) {
      const text = (
        explainRecommendation(recommendDifficulty(perf)) +
        " " +
        summariseDomain(perf)
      ).toLowerCase();
      for (const term of FORBIDDEN) {
        expect(text, `"${text}" should not contain "${term}"`).not.toContain(
          term,
        );
      }
    }
  });
});
