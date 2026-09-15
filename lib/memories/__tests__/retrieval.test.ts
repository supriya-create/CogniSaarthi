import { describe, expect, it } from "vitest";

import {
  advance,
  BUILDING_STEP,
  clampStep,
  deriveState,
  dueMemories,
  hasDecayed,
  HOLDING_STEP,
  initialState,
  intervalFor,
  intervalLabel,
  isDue,
  MAX_STEP,
  MIN_STEP,
  overdueByMs,
  retentionStatus,
  RETRIEVAL_INTERVALS_MS,
  type RetrievalEvent,
  type RetrievalState,
} from "@/lib/memories/retrieval";

/**
 * THE SPACED-RETRIEVAL SCHEDULER.
 *
 * Every test passes its own `now`. Nothing here reads the clock, which
 * is the property that lets the same schedule run on a server and on a
 * device that has been offline for a week and still agree.
 */

const T0 = new Date("2026-09-15T09:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

describe("the interval table", () => {
  it("is the schedule the product promises: 20s → 1m → 5m → 1d → 3d → 7d → 14d → 30d", () => {
    expect([...RETRIEVAL_INTERVALS_MS]).toEqual([
      20 * SECOND,
      1 * MINUTE,
      5 * MINUTE,
      1 * DAY,
      3 * DAY,
      7 * DAY,
      14 * DAY,
      30 * DAY,
    ]);
  });

  it("only ever expands", () => {
    for (let i = 1; i < RETRIEVAL_INTERVALS_MS.length; i++) {
      expect(RETRIEVAL_INTERVALS_MS[i]).toBeGreaterThan(
        RETRIEVAL_INTERVALS_MS[i - 1],
      );
    }
  });

  it("clamps a step outside the table rather than returning undefined", () => {
    expect(clampStep(-5)).toBe(MIN_STEP);
    expect(clampStep(99)).toBe(MAX_STEP);
    expect(clampStep(Number.NaN)).toBe(MIN_STEP);
    expect(intervalFor(-1)).toBe(RETRIEVAL_INTERVALS_MS[MIN_STEP]);
    expect(intervalFor(99)).toBe(RETRIEVAL_INTERVALS_MS[MAX_STEP]);
  });
});

describe("a memory nobody has answered", () => {
  it("starts at the first step and is due immediately", () => {
    const state = initialState(T0);
    expect(state.step).toBe(MIN_STEP);
    expect(state.totalAttempts).toBe(0);
    expect(state.lastOutcome).toBeNull();
    // Due NOW, not in twenty seconds: a memory added this morning
    // should be available this morning.
    expect(isDue(state, T0)).toBe(true);
  });

  it("is reported as NEW, not as needing anything", () => {
    expect(retentionStatus(initialState(T0))).toBe("NEW");
    expect(hasDecayed(initialState(T0))).toBe(false);
  });
});

describe("success", () => {
  it("advances one step and waits the new, longer interval", () => {
    const first = advance(initialState(T0), "RECOGNISED", T0);
    expect(first.step).toBe(1);
    expect(first.dueAt.getTime()).toBe(T0.getTime() + 1 * MINUTE);

    const second = advance(first, "RECOGNISED", at(1 * MINUTE));
    expect(second.step).toBe(2);
    expect(second.dueAt.getTime()).toBe(T0.getTime() + 1 * MINUTE + 5 * MINUTE);
  });

  it("walks the whole schedule one step at a time", () => {
    let state = initialState(T0);
    const steps: number[] = [];
    for (let i = 0; i < RETRIEVAL_INTERVALS_MS.length + 3; i++) {
      state = advance(state, "RECOGNISED", state.dueAt);
      steps.push(state.step);
    }
    expect(steps.slice(0, MAX_STEP)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("stops at the longest interval instead of running off the end", () => {
    let state = initialState(T0);
    for (let i = 0; i < 20; i++) {
      state = advance(state, "RECOGNISED", state.dueAt);
    }
    expect(state.step).toBe(MAX_STEP);
    // Still a real schedule at the ceiling: 30 days, not undefined.
    expect(intervalFor(state.step)).toBe(30 * DAY);
  });

  it("counts a run of recognitions", () => {
    let state = initialState(T0);
    state = advance(state, "RECOGNISED", T0);
    state = advance(state, "RECOGNISED", T0);
    state = advance(state, "RECOGNISED", T0);
    expect(state.streak).toBe(3);
    expect(state.totalAttempts).toBe(3);
  });
});

describe("a miss", () => {
  /** A memory that has been recognised up to the 7-day step. */
  function holding(): RetrievalState {
    let state = initialState(T0);
    for (let i = 0; i < HOLDING_STEP; i++) {
      state = advance(state, "RECOGNISED", state.dueAt);
    }
    return state;
  }

  it("steps BACK one interval — never back to the beginning", () => {
    const before = holding();
    expect(before.step).toBe(HOLDING_STEP);

    const after = advance(before, "NOT_RECOGNISED", at(30 * DAY));
    // One step back, not a reset. Somebody who has recognised their
    // daughter at seven days and misses once goes back to three days,
    // not to twenty seconds.
    expect(after.step).toBe(HOLDING_STEP - 1);
  });

  it("brings the memory back SOON rather than after the stepped-back gap", () => {
    const after = advance(holding(), "NOT_RECOGNISED", at(30 * DAY));
    // The first interval, so the correction is practised while the
    // answer is still reachable.
    expect(after.dueAt.getTime()).toBe(at(30 * DAY).getTime() + 20 * SECOND);
  });

  it("treats being shown the answer exactly as gently as guessing wrong", () => {
    const assisted = advance(holding(), "ASSISTED", at(30 * DAY));
    const wrong = advance(holding(), "NOT_RECOGNISED", at(30 * DAY));
    expect(assisted.step).toBe(wrong.step);
    expect(assisted.dueAt.getTime()).toBe(wrong.dueAt.getTime());
  });

  it("cannot go below the first step", () => {
    let state = initialState(T0);
    for (let i = 0; i < 5; i++) {
      state = advance(state, "NOT_RECOGNISED", T0);
    }
    expect(state.step).toBe(MIN_STEP);
    expect(intervalFor(state.step)).toBe(20 * SECOND);
  });

  it("ends a streak", () => {
    let state = advance(initialState(T0), "RECOGNISED", T0);
    state = advance(state, "RECOGNISED", T0);
    expect(state.streak).toBe(2);
    state = advance(state, "ASSISTED", T0);
    expect(state.streak).toBe(0);
  });
});

describe("moving on without answering", () => {
  it("does not move the schedule at all", () => {
    let state = initialState(T0);
    state = advance(state, "RECOGNISED", T0);
    state = advance(state, "RECOGNISED", T0);
    const before = state.step;

    const after = advance(state, "SKIPPED", at(DAY));

    // "I'd rather not" is not evidence about memory, so it must never
    // move the schedule as though it were — in either direction.
    expect(after.step).toBe(before);
    expect(after.peakStep).toBe(state.peakStep);
  });

  it("offers the memory again in the same sitting", () => {
    const after = advance(initialState(T0), "SKIPPED", T0);
    expect(after.dueAt.getTime()).toBe(T0.getTime() + 20 * SECOND);
  });

  it("never counts as decay, however many times it happens", () => {
    let state = initialState(T0);
    for (let i = 0; i < HOLDING_STEP; i++) {
      state = advance(state, "RECOGNISED", state.dueAt);
    }
    state = advance(state, "SKIPPED", at(30 * DAY));
    state = advance(state, "SKIPPED", at(31 * DAY));
    expect(hasDecayed(state)).toBe(false);
    expect(retentionStatus(state)).toBe("HOLDING");
  });
});

describe("deriving state from a history", () => {
  function event(outcome: RetrievalEvent["outcome"], ms: number): RetrievalEvent {
    return { outcome, occurredAt: at(ms) };
  }

  it("is the same as applying the answers one at a time", () => {
    const events = [
      event("RECOGNISED", 0),
      event("RECOGNISED", MINUTE),
      event("NOT_RECOGNISED", 2 * MINUTE),
    ];

    const folded = deriveState(events, at(3 * MINUTE));

    let manual = initialState(at(3 * MINUTE));
    for (const e of events) manual = advance(manual, e.outcome, e.occurredAt);

    expect(folded.step).toBe(manual.step);
    expect(folded.dueAt.getTime()).toBe(manual.dueAt.getTime());
  });

  it("sorts by when the person answered, not by the order we heard", () => {
    // Exactly what an offline device produces: Tuesday's answer is
    // pushed after Wednesday's. A schedule that depended on arrival
    // order would put the memory somewhere different depending on the
    // weather.
    const chronological = deriveState(
      [event("RECOGNISED", 0), event("NOT_RECOGNISED", DAY)],
      at(2 * DAY),
    );
    const shuffled = deriveState(
      [event("NOT_RECOGNISED", DAY), event("RECOGNISED", 0)],
      at(2 * DAY),
    );

    expect(shuffled.step).toBe(chronological.step);
    expect(shuffled.dueAt.getTime()).toBe(chronological.dueAt.getTime());
    expect(shuffled.lastOutcome).toBe("NOT_RECOGNISED");
  });

  it("is deterministic for identical timestamps", () => {
    const events = [
      event("RECOGNISED", 0),
      event("RECOGNISED", 0),
      event("NOT_RECOGNISED", 0),
    ];
    const a = deriveState(events, T0);
    const b = deriveState(events, T0);
    expect(a).toEqual(b);
    // Ties fall back to the given order, so the last one wins.
    expect(a.lastOutcome).toBe("NOT_RECOGNISED");
  });

  it("returns the fresh state for an empty history", () => {
    expect(deriveState([], T0)).toEqual(initialState(T0));
  });

  it("does not mutate the array it was given", () => {
    const events = [event("NOT_RECOGNISED", DAY), event("RECOGNISED", 0)];
    const copy = [...events];
    deriveState(events, at(2 * DAY));
    expect(events).toEqual(copy);
  });
});

describe("what is due", () => {
  function stateDue(offsetMs: number): RetrievalState {
    return { ...initialState(T0), dueAt: at(offsetMs) };
  }

  it("includes a memory due exactly now", () => {
    expect(isDue(stateDue(0), T0)).toBe(true);
  });

  it("excludes one that is not due yet", () => {
    expect(isDue(stateDue(SECOND), T0)).toBe(false);
    expect(overdueByMs(stateDue(SECOND), T0)).toBeLessThan(0);
  });

  it("puts the longest-waiting memory first", () => {
    const scheduled = [
      { memory: "recent", state: stateDue(-MINUTE) },
      { memory: "ancient", state: stateDue(-30 * DAY) },
      { memory: "future", state: stateDue(DAY) },
      { memory: "middling", state: stateDue(-DAY) },
    ];

    const due = dueMemories(scheduled, T0);
    expect(due.map((d) => d.memory)).toEqual(["ancient", "middling", "recent"]);
  });

  it("caps a sitting", () => {
    const scheduled = Array.from({ length: 20 }, (_, i) => ({
      memory: `m${i}`,
      state: stateDue(-i * MINUTE),
    }));
    expect(dueMemories(scheduled, T0, 4)).toHaveLength(4);
    expect(dueMemories(scheduled, T0, 0)).toHaveLength(0);
  });

  it("is stable for memories that came due at the same moment", () => {
    const scheduled = [
      { memory: "a", state: stateDue(-DAY) },
      { memory: "b", state: stateDue(-DAY) },
      { memory: "c", state: stateDue(-DAY) },
    ];
    expect(dueMemories(scheduled, T0).map((d) => d.memory)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns nothing when nothing is due", () => {
    expect(dueMemories([{ memory: "a", state: stateDue(DAY) }], T0)).toEqual(
      [],
    );
  });
});

describe("retention status", () => {
  function afterRecognitions(count: number): RetrievalState {
    let state = initialState(T0);
    for (let i = 0; i < count; i++) {
      state = advance(state, "RECOGNISED", state.dueAt);
    }
    return state;
  }

  it("reads NEW before anything has been answered", () => {
    expect(retentionStatus(initialState(T0))).toBe("NEW");
  });

  it("reads LEARNING while the gaps are still inside one sitting", () => {
    expect(retentionStatus(afterRecognitions(1))).toBe("LEARNING");
    expect(retentionStatus(afterRecognitions(2))).toBe("LEARNING");
  });

  it("reads BUILDING once the gaps are measured in days", () => {
    const state = afterRecognitions(BUILDING_STEP);
    expect(state.step).toBe(BUILDING_STEP);
    expect(retentionStatus(state)).toBe("BUILDING");
  });

  it("reads HOLDING once recognised across a week", () => {
    const state = afterRecognitions(HOLDING_STEP);
    expect(intervalFor(state.step)).toBe(7 * DAY);
    expect(retentionStatus(state)).toBe("HOLDING");
  });

  it("reads NEEDS_REINFORCEMENT when something held slips", () => {
    // 7 days ✓ → 14 days ✓ → 30 days ✗, the decay the brief describes.
    let state = afterRecognitions(HOLDING_STEP + 2);
    expect(retentionStatus(state)).toBe("HOLDING");

    state = advance(state, "NOT_RECOGNISED", at(120 * DAY));
    expect(retentionStatus(state)).toBe("NEEDS_REINFORCEMENT");
  });

  it("does NOT call a memory nobody has managed yet 'needs reinforcement'", () => {
    // Without the peak check this would be true of every brand-new
    // memory that was missed once, which says something untrue about a
    // photograph nobody has practised.
    const state = advance(initialState(T0), "NOT_RECOGNISED", T0);
    expect(hasDecayed(state)).toBe(false);
    expect(retentionStatus(state)).toBe("LEARNING");
  });

  it("returns to HOLDING once the memory is recognised again", () => {
    let state = afterRecognitions(HOLDING_STEP + 1);
    state = advance(state, "NOT_RECOGNISED", at(60 * DAY));
    expect(retentionStatus(state)).toBe("NEEDS_REINFORCEMENT");

    state = advance(state, "RECOGNISED", at(60 * DAY + MINUTE));
    state = advance(state, "RECOGNISED", at(90 * DAY));
    expect(retentionStatus(state)).toBe("HOLDING");
  });
});

describe("interval labels", () => {
  it("names each step in a unit a person would use", () => {
    expect(intervalLabel(0)).toEqual({ unit: "second", value: 20 });
    expect(intervalLabel(1)).toEqual({ unit: "minute", value: 1 });
    expect(intervalLabel(2)).toEqual({ unit: "minute", value: 5 });
    expect(intervalLabel(3)).toEqual({ unit: "day", value: 1 });
    expect(intervalLabel(5)).toEqual({ unit: "day", value: 7 });
    expect(intervalLabel(MAX_STEP)).toEqual({ unit: "day", value: 30 });
  });

  it("returns no English — the caller translates it", () => {
    for (let step = 0; step <= MAX_STEP; step++) {
      const label = intervalLabel(step);
      expect(["second", "minute", "day"]).toContain(label.unit);
      expect(Number.isInteger(label.value)).toBe(true);
    }
  });
});
