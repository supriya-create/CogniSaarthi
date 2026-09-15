import { describe, expect, it } from "vitest";

import { checkCopy } from "@/lib/intelligence/safety";
import {
  DECAY_LOOKBACK,
  deriveReinforcementAlerts,
  isWorthSurfacing,
  signalFor,
  type MemoryDecaySignal,
} from "@/lib/memories/reinforcement";
import {
  advance,
  HOLDING_STEP,
  initialState,
  type RetrievalOutcome,
  type RetrievalState,
} from "@/lib/memories/retrieval";

/**
 * WHEN A CAREGIVER SHOULD HEAR ABOUT MEMORY LANE.
 *
 * The thing being protected here is the alert list. A memory slipping
 * back one interval is an ordinary part of spaced retrieval — it is
 * what the schedule is FOR — and an alert for each one would teach a
 * caregiver to ignore the list, including on the day it matters.
 */

const T0 = new Date("2026-09-15T09:00:00.000Z");
const DAY = 86_400_000;
const TZ = "Asia/Kolkata";

/** Walk a memory up the schedule, then apply the given outcomes. */
function history(
  recognitions: number,
  ...then: RetrievalOutcome[]
): RetrievalState {
  let state = initialState(T0);
  for (let i = 0; i < recognitions; i++) {
    state = advance(state, "RECOGNISED", state.dueAt);
  }
  let clock = state.dueAt.getTime();
  for (const outcome of then) {
    clock += DAY;
    state = advance(state, outcome, new Date(clock));
  }
  return state;
}

function signal(state: RetrievalState, title = "Meera"): MemoryDecaySignal {
  return signalFor("m1", title, state);
}

describe("which memories are worth mentioning", () => {
  it("surfaces one that reached a week and has since needed help", () => {
    const state = history(HOLDING_STEP + 2, "NOT_RECOGNISED");
    expect(isWorthSurfacing(signal(state))).toBe(true);
    expect(signal(state).status).toBe("NEEDS_REINFORCEMENT");
  });

  it("treats being shown the answer as the same signal", () => {
    expect(
      isWorthSurfacing(signal(history(HOLDING_STEP + 2, "ASSISTED"))),
    ).toBe(true);
  });

  it("says nothing about a memory that was never held", () => {
    // Missing a photograph somebody is still learning is the schedule
    // working, not news.
    expect(isWorthSurfacing(signal(history(1, "NOT_RECOGNISED")))).toBe(false);
    expect(isWorthSurfacing(signal(history(0, "NOT_RECOGNISED")))).toBe(false);
  });

  it("says nothing about a memory that is holding perfectly well", () => {
    expect(isWorthSurfacing(signal(history(HOLDING_STEP + 1)))).toBe(false);
  });

  it("says nothing when somebody simply moved on", () => {
    // "I'd rather not" must never reach a caregiver as evidence.
    expect(
      isWorthSurfacing(signal(history(HOLDING_STEP + 2, "SKIPPED"))),
    ).toBe(false);
  });

  it("waits for enough history to have a baseline to slip from", () => {
    const barely = signal({
      ...history(HOLDING_STEP + 1, "NOT_RECOGNISED"),
      totalAttempts: DECAY_LOOKBACK - 1,
    });
    expect(isWorthSurfacing(barely)).toBe(false);
  });

  it("stops mentioning it once the memory is recognised again", () => {
    const recovered = history(HOLDING_STEP + 2, "NOT_RECOGNISED", "RECOGNISED");
    expect(isWorthSurfacing(signal(recovered))).toBe(false);
  });
});

describe("the alert itself", () => {
  const slipped = signal(history(HOLDING_STEP + 2, "NOT_RECOGNISED"));

  it("is not raised when nothing has slipped", () => {
    expect(
      deriveReinforcementAlerts({
        now: T0,
        timeZone: TZ,
        memories: [signal(history(HOLDING_STEP + 1))],
      }),
    ).toEqual([]);
  });

  it("is not raised for a person with no memories at all", () => {
    expect(
      deriveReinforcementAlerts({ now: T0, timeZone: TZ, memories: [] }),
    ).toEqual([]);
  });

  it("reuses PERFORMANCE_CHANGE rather than inventing a type", () => {
    const [alert] = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [slipped],
    });
    expect(alert.type).toBe("PERFORMANCE_CHANGE");
    // INFO, not ATTENTION: this is the schedule adjusting itself, and
    // the app has already done the only thing to be done about it.
    expect(alert.severity).toBe("INFO");
  });

  it("is ONE alert however many memories slipped", () => {
    const alerts = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [
        signalFor("a", "Meera", history(HOLDING_STEP + 2, "NOT_RECOGNISED")),
        signalFor("b", "Anita", history(HOLDING_STEP + 2, "ASSISTED")),
        signalFor("c", "Rahul", history(HOLDING_STEP + 2, "NOT_RECOGNISED")),
      ],
    });
    // A week in which three photographs needed help is one thing to
    // tell somebody, not three separate alarms.
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("3 memories");
  });

  it("names the memory when there is exactly one", () => {
    const [alert] = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [slipped],
    });
    expect(alert.body).toContain("Meera");
  });

  it("de-duplicates to at most one per week", () => {
    const monday = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [slipped],
    })[0];
    const tuesday = deriveReinforcementAlerts({
      now: new Date(T0.getTime() + DAY),
      timeZone: TZ,
      memories: [slipped],
    })[0];
    const fortnightLater = deriveReinforcementAlerts({
      now: new Date(T0.getTime() + 14 * DAY),
      timeZone: TZ,
      memories: [slipped],
    })[0];

    expect(tuesday.dedupeKey).toBe(monday.dedupeKey);
    expect(fortnightLater.dedupeKey).not.toBe(monday.dedupeKey);
  });

  it("keys on the week alone, so a second memory slipping is not a second alert", () => {
    const one = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [signalFor("a", "Meera", history(HOLDING_STEP + 2, "ASSISTED"))],
    })[0];
    const two = deriveReinforcementAlerts({
      now: T0,
      timeZone: TZ,
      memories: [
        signalFor("a", "Meera", history(HOLDING_STEP + 2, "ASSISTED")),
        signalFor("b", "Anita", history(HOLDING_STEP + 2, "ASSISTED")),
      ],
    })[0];
    expect(two.dedupeKey).toBe(one.dedupeKey);
  });
});

describe("what the alert is allowed to say", () => {
  function everySentence(): string[] {
    const cases: MemoryDecaySignal[][] = [
      [signalFor("a", "Meera", history(HOLDING_STEP + 2, "NOT_RECOGNISED"))],
      [
        signalFor("a", "Meera", history(HOLDING_STEP + 2, "ASSISTED")),
        signalFor("b", "Anita", history(HOLDING_STEP + 2, "ASSISTED")),
      ],
    ];
    return cases
      .flatMap((memories) =>
        deriveReinforcementAlerts({ now: T0, timeZone: TZ, memories }),
      )
      .flatMap((alert) => [alert.title, alert.body]);
  }

  it("makes no medical claim, in any variant", () => {
    for (const sentence of everySentence()) {
      expect(checkCopy(sentence).violations, sentence).toEqual([]);
    }
  });

  it("never uses the language of deterioration", () => {
    for (const sentence of everySentence()) {
      const text = sentence.toLowerCase();
      for (const banned of [
        "deteriorat",
        "decline",
        "worse",
        "losing",
        "forgetting",
        "detected",
      ]) {
        expect(text, `"${sentence}" says "${banned}"`).not.toContain(banned);
      }
    }
  });

  it("names where this is happening, so the alert is actionable", () => {
    const bodies = everySentence().filter((s) => s.includes("reinforcement"));
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).toContain("Memory Lane");
    }
  });

  it("says the app has already handled it, and disclaims the measurement", () => {
    for (const body of everySentence().filter((s) =>
      s.includes("Memory Lane"),
    )) {
      // A caregiver should not be left wondering what to do. The app
      // has already narrowed the schedule; the alert says so.
      expect(body).toContain("show");
      expect(body).toContain("not a health measurement");
    }
  });

  it("puts the app, not the person, in the subject of the title", () => {
    const titles = [
      deriveReinforcementAlerts({
        now: T0,
        timeZone: TZ,
        memories: [
          signalFor("a", "Meera", history(HOLDING_STEP + 2, "ASSISTED")),
        ],
      })[0].title,
      deriveReinforcementAlerts({
        now: T0,
        timeZone: TZ,
        memories: [
          signalFor("a", "Meera", history(HOLDING_STEP + 2, "ASSISTED")),
          signalFor("b", "Anita", history(HOLDING_STEP + 2, "ASSISTED")),
        ],
      })[0].title,
    ];
    for (const title of titles) {
      expect(title).toContain("being shown more often");
    }
  });
});
