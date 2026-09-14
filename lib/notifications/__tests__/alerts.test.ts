import { describe, expect, it } from "vitest";

import {
  deriveAlerts,
  severityRank,
  type AlertContext,
  type DomainSignal,
} from "@/lib/notifications/alerts";

const TZ = "Asia/Kolkata";
const NOW = new Date("2026-09-14T06:00:00Z");

function domain(overrides: Partial<DomainSignal> = {}): DomainSignal {
  return {
    domain: "SHORT_TERM_MEMORY",
    trend: "stable",
    indicatorNow: 80,
    indicatorBaseline: 80,
    coldStart: false,
    ...overrides,
  };
}

function context(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    now: NOW,
    timeZone: TZ,
    missedToday: 0,
    missedImportantToday: 0,
    daysSinceLastActivity: 0,
    completedToday: 0,
    dailyGoal: 3,
    domains: [domain()],
    ...overrides,
  };
}

/** No alert should ever use clinical or alarming language. */
function assertNonMedical(text: string) {
  for (const banned of [
    "dementia",
    "deteriorat",
    "diagnos",
    "emergency",
    "critical",
    "disease",
    "decline",
  ]) {
    expect(text.toLowerCase()).not.toContain(banned);
  }
}

describe("missed reminders", () => {
  it("does not alert on a single ordinary miss (signal, not noise)", () => {
    const alerts = deriveAlerts(context({ missedToday: 1 }));
    expect(alerts.some((a) => a.type === "REMINDER_MISSED")).toBe(false);
  });

  it("raises ATTENTION for one missed important reminder", () => {
    const alerts = deriveAlerts(
      context({ missedToday: 1, missedImportantToday: 1 }),
    );
    const missed = alerts.find((a) => a.type === "REMINDER_MISSED");
    expect(missed?.severity).toBe("ATTENTION");
  });

  it("raises IMPORTANT for three or more missed", () => {
    const alerts = deriveAlerts(context({ missedToday: 3 }));
    const missed = alerts.find((a) => a.type === "REMINDER_MISSED");
    expect(missed?.severity).toBe("IMPORTANT");
    assertNonMedical(`${missed?.title} ${missed?.body}`);
  });
});

describe("inactivity", () => {
  it("stays quiet under three days", () => {
    const alerts = deriveAlerts(context({ daysSinceLastActivity: 2 }));
    expect(alerts.some((a) => a.type === "INACTIVITY")).toBe(false);
  });
  it("is ATTENTION at three days and IMPORTANT at six", () => {
    expect(
      deriveAlerts(context({ daysSinceLastActivity: 3 })).find(
        (a) => a.type === "INACTIVITY",
      )?.severity,
    ).toBe("ATTENTION");
    expect(
      deriveAlerts(context({ daysSinceLastActivity: 6 })).find(
        (a) => a.type === "INACTIVITY",
      )?.severity,
    ).toBe("IMPORTANT");
  });
});

describe("simulated users", () => {
  it("User A — consistent: only a warm 'complete' note", () => {
    const alerts = deriveAlerts(
      context({
        completedToday: 3,
        dailyGoal: 3,
        daysSinceLastActivity: 0,
        domains: [domain({ trend: "improving", indicatorNow: 82 })],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("DAILY_COMPLETE");
    expect(alerts[0].severity).toBe("INFO");
  });

  it("User B — frequent skipper: a lone ordinary miss is not escalated", () => {
    const alerts = deriveAlerts(context({ missedToday: 1 }));
    expect(alerts.filter((a) => a.severity !== "INFO")).toHaveLength(0);
  });

  it("User C — strong performer: no attention-grade alerts", () => {
    const alerts = deriveAlerts(
      context({
        completedToday: 3,
        domains: [domain({ trend: "improving", indicatorNow: 90 })],
      }),
    );
    expect(alerts.every((a) => a.severity === "INFO")).toBe(true);
  });

  it("User D — recent change: neutral ATTENTION alert, non-medical", () => {
    const alerts = deriveAlerts(
      context({
        domains: [
          domain({
            domain: "SHORT_TERM_MEMORY",
            trend: "declining",
            indicatorNow: 68,
            indicatorBaseline: 80,
          }),
        ],
      }),
    );
    const perf = alerts.find((a) => a.type === "PERFORMANCE_CHANGE");
    expect(perf?.severity).toBe("ATTENTION");
    assertNonMedical(`${perf?.title} ${perf?.body}`);
    expect(perf?.body).toContain("not a health measurement");
  });

  it("User E — nothing happening: no unnecessary notifications", () => {
    const alerts = deriveAlerts(
      context({
        completedToday: 0,
        daysSinceLastActivity: 1,
        missedToday: 0,
        domains: [domain({ coldStart: true, indicatorNow: null, indicatorBaseline: null })],
      }),
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("dedupe keys and ranking", () => {
  it("keys a missed-reminder alert per local day", () => {
    const alerts = deriveAlerts(context({ missedToday: 3 }));
    expect(alerts[0].dedupeKey).toBe("missed:2026-09-14");
  });
  it("orders severities IMPORTANT > ATTENTION > INFO", () => {
    expect(severityRank("IMPORTANT")).toBeGreaterThan(severityRank("ATTENTION"));
    expect(severityRank("ATTENTION")).toBeGreaterThan(severityRank("INFO"));
  });
  it("ignores cold-start domains for performance changes", () => {
    const alerts = deriveAlerts(
      context({
        domains: [
          domain({
            trend: "declining",
            indicatorNow: 40,
            indicatorBaseline: 80,
            coldStart: true,
          }),
        ],
      }),
    );
    expect(alerts.some((a) => a.type === "PERFORMANCE_CHANGE")).toBe(false);
  });
});
