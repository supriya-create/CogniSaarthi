import { describe, expect, it } from "vitest";

import type { PerformanceSample } from "@/lib/cognitive-performance/types";
import {
  buildDailySummary,
  buildWeeklySummary,
  computeWeeklyDomainTrend,
} from "@/lib/summaries/compute";

function sample(i: number, accuracy: number, score: number): PerformanceSample {
  return {
    domain: "SHORT_TERM_MEMORY",
    difficulty: "MEDIUM",
    score,
    accuracy,
    mistakes: 0,
    hints: 0,
    roundsTotal: 5,
    avgResponseTimeMs: 0,
    completedAt: new Date(2026, 8, 1 + i),
  };
}

describe("buildDailySummary", () => {
  it("summarises activities, participation and reminders", () => {
    const summary = buildDailySummary({
      completedToday: 3,
      dailyGoal: 3,
      domainsCompletedToday: ["SHORT_TERM_MEMORY", "ATTENTION"],
      reminderTotalToday: 5,
      reminderAcknowledgedToday: 4,
    });
    expect(summary.activities).toEqual({ completed: 3, goal: 3 });
    expect(summary.memory).toBe("good");
    expect(summary.attention).toBe("done");
    expect(summary.reminders).toEqual({ total: 5, acknowledged: 4 });
  });

  it("shows 'not yet' when a domain was not played", () => {
    const summary = buildDailySummary({
      completedToday: 1,
      dailyGoal: 3,
      domainsCompletedToday: ["ATTENTION"],
      reminderTotalToday: 0,
      reminderAcknowledgedToday: 0,
    });
    expect(summary.memory).toBe("notYet");
    expect(summary.attention).toBe("done");
  });
});

describe("computeWeeklyDomainTrend", () => {
  it("gives a before/after indicator using the Phase 2 maths", () => {
    // 10 sessions, newest (index 9) strongest — accuracy climbs.
    const samples = Array.from({ length: 10 }, (_, i) =>
      sample(i, 0.5 + i * 0.04, 50 + i * 4),
    );
    const trend = computeWeeklyDomainTrend("SHORT_TERM_MEMORY", samples);
    expect(trend.current).not.toBeNull();
    expect(trend.previous).not.toBeNull();
    expect(trend.current!).toBeGreaterThan(trend.previous!);
    expect(trend.trend).toBe("improving");
    expect(trend.currentDifficulty).toBe("MEDIUM");
  });

  it("has a null previous when there is under one full window", () => {
    const samples = [sample(0, 0.8, 80), sample(1, 0.85, 85)];
    const trend = computeWeeklyDomainTrend("SHORT_TERM_MEMORY", samples);
    expect(trend.current).not.toBeNull();
    expect(trend.previous).toBeNull();
  });
});

describe("buildWeeklySummary", () => {
  it("derives consistency and reminder completion rate", () => {
    const summary = buildWeeklySummary({
      weekSessionCount: 8,
      activeDays: 5,
      daysInWeek: 7,
      reminderTotal: 10,
      reminderAcknowledged: 8,
      mostUsedActivity: "Remember the Objects",
      domainTrends: [],
    });
    expect(summary.completionConsistency).toBe(71); // 5/7
    expect(summary.reminderCompletionRate).toBe(80); // 8/10
  });

  it("returns a null rate when no reminders were due", () => {
    const summary = buildWeeklySummary({
      weekSessionCount: 0,
      activeDays: 0,
      daysInWeek: 7,
      reminderTotal: 0,
      reminderAcknowledged: 0,
      mostUsedActivity: null,
      domainTrends: [],
    });
    expect(summary.reminderCompletionRate).toBeNull();
    expect(summary.completionConsistency).toBe(0);
  });
});
