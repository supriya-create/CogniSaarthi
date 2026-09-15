import { describe, expect, it } from "vitest";

import {
  buildLaneSession,
  buildRound,
  HARDER_MODE_STEP,
  modeFor,
  SESSION_LIMIT,
  type LaneMemory,
} from "@/lib/memories/lane";
import {
  advance,
  HOLDING_STEP,
  initialState,
  type RetrievalState,
} from "@/lib/memories/retrieval";

/**
 * BUILDING ONE MEMORY LANE SITTING.
 *
 * `shuffleFn` is passed as the identity function throughout, so the
 * option order is fixed and the assertions are about WHAT is offered
 * rather than about where it happened to land.
 */

const T0 = new Date("2026-09-15T09:00:00.000Z");
const identity = <V,>(items: readonly V[]): V[] => [...items];

function person(
  id: string,
  title: string,
  relationship: string | null = null,
  overrides: Partial<LaneMemory> = {},
): LaneMemory {
  return {
    id,
    category: "PERSON",
    title,
    relationship,
    description: null,
    hasImage: true,
    hasAudio: false,
    ...overrides,
  };
}

const MEERA = person("m1", "Meera", "Daughter");
const ANITA = person("m2", "Anita", "Sister");
const RAHUL = person("m3", "Rahul", "Son");
const HOUSE: LaneMemory = {
  id: "p1",
  category: "PLACE",
  title: "The house in Jorhat",
  relationship: null,
  description: "Where you lived when the children were small.",
  hasImage: true,
  hasAudio: true,
};

function dueState(step = 0): RetrievalState {
  return { ...initialState(T0), step, dueAt: T0 };
}

describe("choosing how to ask", () => {
  it("always asks the gentlest way while a memory is still being learned", () => {
    for (let step = 0; step < HARDER_MODE_STEP; step++) {
      expect(modeFor(MEERA, step)).toBe("PERSON_RECOGNITION");
    }
  });

  it("only uses harder modes once a memory has survived a real interval", () => {
    // Errorless learning: somebody's FIRST prompt about a photograph
    // must never be the hardest form of the question.
    const early = modeFor(MEERA, HARDER_MODE_STEP - 1);
    expect(early).toBe("PERSON_RECOGNITION");

    const later = modeFor(MEERA, HARDER_MODE_STEP);
    expect(["NAME_RECALL", "RELATIONSHIP_RECALL"]).toContain(later);
  });

  it("is deterministic — the same memory at the same step is asked the same way", () => {
    for (let step = 0; step <= 7; step++) {
      expect(modeFor(MEERA, step)).toBe(modeFor(MEERA, step));
      expect(modeFor(HOUSE, step)).toBe(modeFor(HOUSE, step));
    }
  });

  it("alternates the two harder person modes rather than repeating one", () => {
    const modes = [3, 4, 5, 6, 7].map((step) => modeFor(MEERA, step));
    expect(new Set(modes).size).toBe(2);
  });

  it("never asks for a name that was never recorded", () => {
    const noRelationship = person("m9", "Bina");
    for (let step = 0; step <= 7; step++) {
      expect(modeFor(noRelationship, step)).toBe("PERSON_RECOGNITION");
    }
  });

  it("never hides a photograph that does not exist", () => {
    const noPhoto = person("m8", "Gopal", "Brother", { hasImage: false });
    for (let step = 0; step <= 7; step++) {
      expect(modeFor(noPhoto, step)).toBe("PERSON_RECOGNITION");
    }
  });

  it("uses the right question for each kind of memory", () => {
    expect(modeFor(HOUSE, 0)).toBe("PLACE_RECOGNITION");
    expect(modeFor({ ...HOUSE, category: "THING" }, 0)).toBe("CONTEXT_RECALL");
    expect(modeFor({ ...HOUSE, category: "MOMENT" }, 0)).toBe("CONTEXT_RECALL");
  });
});

describe("one prompt", () => {
  const pool = [MEERA, ANITA, RAHUL, HOUSE];

  it("always includes the right answer among the options", () => {
    for (let step = 0; step <= 7; step++) {
      const round = buildRound(MEERA, step, pool, identity);
      expect(round.options.some((o) => o.id === round.correctOptionId)).toBe(
        true,
      );
    }
  });

  it("offers no two identical labels", () => {
    const round = buildRound(MEERA, 0, pool, identity);
    const labels = round.options.map((o) => o.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("prefers the person's own memories as the other choices", () => {
    const round = buildRound(MEERA, 0, pool, identity);
    const labels = round.options.map((o) => o.label);
    // Anita and Rahul are real people in this person's life, which is
    // what makes the activity personal rather than generic.
    expect(labels).toContain("Anita");
    expect(labels).toContain("Rahul");
  });

  it("tops up with neutral filler when somebody has very few memories", () => {
    const round = buildRound(MEERA, 0, [MEERA], identity);
    expect(round.options.length).toBeGreaterThanOrEqual(2);
    expect(round.options.some((o) => o.id === MEERA.id)).toBe(true);
  });

  it("asks for a relationship in RELATIONSHIP_RECALL, and offers relationships", () => {
    const step = [3, 4, 5, 6, 7].find(
      (s) => modeFor(MEERA, s) === "RELATIONSHIP_RECALL",
    )!;
    const round = buildRound(MEERA, step, pool, identity);

    expect(round.correctLabel).toBe("Daughter");
    expect(round.promptValue).toBe("Meera");
    expect(round.options.map((o) => o.label)).toContain("Daughter");
    // Distractors are relationships too — offering "Anita" as an
    // answer to "Meera is your…" would be unanswerable, not difficult.
    const labels = round.options.map((o) => o.label);
    expect(labels).not.toContain("Anita");
  });

  it("hides the photograph only when the photograph would be the answer", () => {
    const nameStep = [3, 4, 5, 6, 7].find(
      (s) => modeFor(MEERA, s) === "NAME_RECALL",
    )!;
    expect(buildRound(MEERA, nameStep, pool, identity).showPhotoFirst).toBe(
      false,
    );
    expect(buildRound(MEERA, 0, pool, identity).showPhotoFirst).toBe(true);
    expect(buildRound(HOUSE, 0, pool, identity).showPhotoFirst).toBe(true);
  });

  it("accepts the name OR the relationship aloud, whichever way it asked", () => {
    for (const step of [0, 3, 4, 5]) {
      const round = buildRound(MEERA, step, pool, identity);
      // "That's my daughter" in answer to "Who is this?" is a
      // recognition. Marking it wrong on a grammatical technicality
      // would be absurd.
      expect(round.acceptedAnswers).toContain("Meera");
      expect(round.acceptedAnswers).toContain("Daughter");
    }
  });

  it("carries the errorless correction with it", () => {
    const round = buildRound(HOUSE, 0, pool, identity);
    expect(round.answer).toEqual({
      title: "The house in Jorhat",
      relationship: null,
      description: "Where you lived when the children were small.",
      hasImage: true,
      hasAudio: true,
    });
  });

  it("records the step it was presented at", () => {
    expect(buildRound(MEERA, 4, pool, identity).step).toBe(4);
  });
});

describe("a sitting", () => {
  it("contains only what is due", () => {
    const session = buildLaneSession(
      [
        { memory: MEERA, state: dueState() },
        { memory: ANITA, state: { ...initialState(T0), dueAt: new Date(T0.getTime() + 86_400_000) } },
        { memory: HOUSE, state: dueState() },
      ],
      T0,
      SESSION_LIMIT,
      identity,
    );

    expect(session.rounds.map((r) => r.memoryId)).toEqual(["m1", "p1"]);
    expect(session.waitingCount).toBe(1);
    expect(session.nextDueAt?.getTime()).toBe(T0.getTime() + 86_400_000);
  });

  it("is capped, so a long gap does not produce a chore", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      memory: person(`m${i}`, `Person ${i}`),
      state: dueState(),
    }));
    expect(buildLaneSession(many, T0, SESSION_LIMIT, identity).rounds.length).toBe(
      SESSION_LIMIT,
    );
  });

  it("keeps a memory with no photograph — a name is still a real prompt", () => {
    const noPhoto = person("np", "Bina", "Neighbour", { hasImage: false });
    const session = buildLaneSession(
      [{ memory: noPhoto, state: dueState() }],
      T0,
      SESSION_LIMIT,
      identity,
    );
    expect(session.rounds).toHaveLength(1);
    expect(session.rounds[0].showPhotoFirst).toBe(false);
  });

  it("drops a memory with no usable title — an unanswerable prompt is worse than a short sitting", () => {
    const blank = person("b", "   ");
    const session = buildLaneSession(
      [
        { memory: blank, state: dueState() },
        { memory: MEERA, state: dueState() },
      ],
      T0,
      SESSION_LIMIT,
      identity,
    );
    expect(session.rounds.map((r) => r.memoryId)).toEqual(["m1"]);
  });

  it("is empty, and says when to come back, on a quiet day", () => {
    const later = new Date(T0.getTime() + 3 * 86_400_000);
    const session = buildLaneSession(
      [{ memory: MEERA, state: { ...initialState(T0), dueAt: later } }],
      T0,
      SESSION_LIMIT,
      identity,
    );
    expect(session.rounds).toEqual([]);
    expect(session.waitingCount).toBe(1);
    expect(session.nextDueAt?.getTime()).toBe(later.getTime());
  });

  it("handles a person with no memories at all", () => {
    const session = buildLaneSession([], T0, SESSION_LIMIT, identity);
    expect(session.rounds).toEqual([]);
    expect(session.waitingCount).toBe(0);
    expect(session.nextDueAt).toBeNull();
  });

  it("asks a well-practised memory harder than a new one, in the same sitting", () => {
    let held = initialState(T0);
    for (let i = 0; i < HOLDING_STEP; i++) {
      held = advance(held, "RECOGNISED", held.dueAt);
    }

    const session = buildLaneSession(
      [
        { memory: MEERA, state: { ...held, dueAt: T0 } },
        { memory: RAHUL, state: dueState() },
      ],
      T0,
      SESSION_LIMIT,
      identity,
    );

    const meera = session.rounds.find((r) => r.memoryId === "m1")!;
    const rahul = session.rounds.find((r) => r.memoryId === "m3")!;
    expect(rahul.mode).toBe("PERSON_RECOGNITION");
    expect(["NAME_RECALL", "RELATIONSHIP_RECALL"]).toContain(meera.mode);
  });
});
