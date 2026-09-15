import { describe, expect, it } from "vitest";

import { computeBaseline, deltaFromBaseline } from "@/lib/intelligence/baseline";
import { computeTrend, isReportableTrend } from "@/lib/intelligence/trends";
import { confidenceFor, canStateAsFact } from "@/lib/intelligence/confidence";
import { computeActivityRoutine } from "@/lib/intelligence/longitudinal";
import { NOW, series } from "@/lib/intelligence/__tests__/_helpers";

/**
 * Baseline, trends and confidence — the analytical core. The property
 * that matters throughout: the engine is willing to say "I don't know".
 */

// ---------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------

describe("baseline", () => {
  it("refuses to exist on too little data", () => {
    const baseline = computeBaseline(
      "SHORT_TERM_MEMORY",
      series("SHORT_TERM_MEMORY", [80, 85]),
    );
    expect(baseline.state).toBe("NOT_ESTABLISHED");
    expect(baseline.level).toBeNull();
    expect(baseline.sessionCount).toBe(2);
  });

  it("establishes once there are enough sessions", () => {
    const baseline = computeBaseline(
      "SHORT_TERM_MEMORY",
      series("SHORT_TERM_MEMORY", [70, 72, 74]),
    );
    expect(baseline.state).toBe("ESTABLISHED");
    expect(baseline.level).not.toBeNull();
    expect(baseline.establishedAt).not.toBeNull();
  });

  it("is built from the EARLIEST sessions, so later change is visible", () => {
    // Starts low, improves a lot. A baseline that followed current form
    // would hide the improvement entirely.
    const samples = series("SHORT_TERM_MEMORY", [40, 42, 44, 90, 92, 94]);
    const baseline = computeBaseline("SHORT_TERM_MEMORY", samples);
    expect(baseline.level).not.toBeNull();
    // Reference sits near the early level, not the recent one.
    expect(baseline.level!).toBeLessThan(70);
  });

  it("reports movement away from the baseline, or null when unknown", () => {
    const baseline = computeBaseline(
      "SHORT_TERM_MEMORY",
      series("SHORT_TERM_MEMORY", [50, 52, 54]),
    );
    expect(deltaFromBaseline(baseline, 70)).toBe(70 - baseline.level!);
    expect(deltaFromBaseline(baseline, null)).toBeNull();

    const none = computeBaseline("ATTENTION", []);
    expect(deltaFromBaseline(none, 70)).toBeNull();
  });

  it("only counts the domain asked about", () => {
    const mixed = [
      ...series("SHORT_TERM_MEMORY", [80, 80, 80]),
      ...series("ATTENTION", [30]),
    ];
    expect(computeBaseline("ATTENTION", mixed).state).toBe("NOT_ESTABLISHED");
    expect(computeBaseline("SHORT_TERM_MEMORY", mixed).state).toBe("ESTABLISHED");
  });
});

// ---------------------------------------------------------------
// Trends
// ---------------------------------------------------------------

describe("trends", () => {
  it("says INSUFFICIENT_DATA rather than guessing", () => {
    const reading = computeTrend(
      "SHORT_TERM_MEMORY",
      series("SHORT_TERM_MEMORY", [80, 82]),
      "MEDIUM",
      NOW,
    );
    expect(reading.classification).toBe("INSUFFICIENT_DATA");
    expect(isReportableTrend(reading)).toBe(false);
  });

  it("detects a genuine improvement between windows", () => {
    // Previous three weeks low, recent three weeks clearly higher.
    const samples = [
      ...series("SHORT_TERM_MEMORY", [50, 52, 51, 50], { startDaysAgo: 40, dayStep: 2 }),
      ...series("SHORT_TERM_MEMORY", [80, 82, 84, 86], { startDaysAgo: 14, dayStep: 3 }),
    ];
    const reading = computeTrend("SHORT_TERM_MEMORY", samples, "MEDIUM", NOW);
    expect(reading.classification).toBe("IMPROVING");
    expect(reading.delta!).toBeGreaterThan(0);
  });

  it("detects activities becoming more challenging", () => {
    const samples = [
      ...series("SHORT_TERM_MEMORY", [88, 86, 90, 88], { startDaysAgo: 40, dayStep: 2 }),
      ...series("SHORT_TERM_MEMORY", [60, 58, 62, 59], { startDaysAgo: 14, dayStep: 3 }),
    ];
    const reading = computeTrend("SHORT_TERM_MEMORY", samples, "MEDIUM", NOW);
    expect(reading.classification).toBe("DECLINING");
    expect(reading.delta!).toBeLessThan(0);
  });

  it("calls wildly swinging results VARIABLE, not a direction", () => {
    const samples = series("SHORT_TERM_MEMORY", [95, 20, 90, 25, 85], {
      startDaysAgo: 14,
      dayStep: 2,
    });
    const reading = computeTrend("SHORT_TERM_MEMORY", samples, "MEDIUM", NOW);
    expect(reading.classification).toBe("VARIABLE");
  });

  it("calls small movement STABLE", () => {
    const samples = [
      ...series("SHORT_TERM_MEMORY", [75, 76, 74, 75], { startDaysAgo: 40, dayStep: 2 }),
      ...series("SHORT_TERM_MEMORY", [76, 75, 77, 76], { startDaysAgo: 14, dayStep: 3 }),
    ];
    const reading = computeTrend("SHORT_TERM_MEMORY", samples, "MEDIUM", NOW);
    expect(reading.classification).toBe("STABLE");
  });

  it("supports short and long horizons too", () => {
    const samples = series("SHORT_TERM_MEMORY", [70, 72, 74, 76, 78, 80], {
      startDaysAgo: 12,
      dayStep: 2,
    });
    expect(computeTrend("SHORT_TERM_MEMORY", samples, "SHORT", NOW).horizon).toBe("SHORT");
    expect(computeTrend("SHORT_TERM_MEMORY", samples, "LONG", NOW).horizon).toBe("LONG");
  });
});

// ---------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------

describe("confidence", () => {
  it("is LOW with barely any sessions", () => {
    expect(
      confidenceFor({ sessionCount: 2, consistency: 90, daysSinceLastActivity: 1 }),
    ).toBe("LOW");
  });

  it("rises with a consistent history", () => {
    expect(
      confidenceFor({ sessionCount: 10, consistency: 90, daysSinceLastActivity: 1 }),
    ).toBe("HIGH");
  });

  it("is held back by swinging results", () => {
    expect(
      confidenceFor({ sessionCount: 10, consistency: 20, daysSinceLastActivity: 1 }),
    ).toBe("MEDIUM");
  });

  it("is downgraded when the data is stale", () => {
    const fresh = confidenceFor({
      sessionCount: 10,
      consistency: 90,
      daysSinceLastActivity: 1,
    });
    const stale = confidenceFor({
      sessionCount: 10,
      consistency: 90,
      daysSinceLastActivity: 60,
    });
    expect(fresh).toBe("HIGH");
    expect(stale).toBe("MEDIUM");
  });

  it("is LOW when the domain has never been played", () => {
    expect(
      confidenceFor({ sessionCount: 0, consistency: null, daysSinceLastActivity: null }),
    ).toBe("LOW");
  });

  it("will not let a low-confidence reading be stated as fact", () => {
    expect(canStateAsFact("LOW")).toBe(false);
    expect(canStateAsFact("MEDIUM")).toBe(true);
  });
});

// ---------------------------------------------------------------
// Activity routine
// ---------------------------------------------------------------

describe("activity routine", () => {
  it("counts distinct active days, not sessions", () => {
    // Three activities, all on the same day.
    const sameDay = [
      ...series("SHORT_TERM_MEMORY", [80], { startDaysAgo: 2 }),
      ...series("ATTENTION", [80], { startDaysAgo: 2 }),
      ...series("WORKING_MEMORY", [80], { startDaysAgo: 2 }),
    ];
    const routine = computeActivityRoutine(sameDay, NOW, "Asia/Kolkata");
    expect(routine.activeDays).toBe(1);
    expect(routine.totalActivities).toBe(3);
  });

  it("reports an empty routine without inventing anything", () => {
    const routine = computeActivityRoutine([], NOW);
    expect(routine.activeDays).toBe(0);
    expect(routine.routineConsistency).toBe(0);
    expect(routine.daysSinceLastActivity).toBeNull();
  });

  it("measures days since the last activity", () => {
    const routine = computeActivityRoutine(
      series("SHORT_TERM_MEMORY", [80], { startDaysAgo: 6 }),
      NOW,
    );
    expect(routine.daysSinceLastActivity).toBe(6);
  });
});
