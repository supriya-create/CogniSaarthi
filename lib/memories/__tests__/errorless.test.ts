import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANGUAGES, getDict, type Dict } from "@/lib/i18n/dictionaries";
import { checkCopy } from "@/lib/intelligence/safety";
import {
  appendRepeat,
  buildRound,
  type LaneMemory,
} from "@/lib/memories/lane";

/**
 * ERRORLESS LEARNING, ENFORCED.
 *
 * The rule Memory Lane exists to keep is that somebody looking at a
 * photograph of their daughter is never told they got it wrong. That
 * is a property of copy and of styling, which are exactly the things a
 * later well-meaning edit quietly breaks — so it is asserted here
 * rather than left as a paragraph in a comment.
 */

const identity = <V,>(items: readonly V[]): V[] => [...items];

const MEERA: LaneMemory = {
  id: "m1",
  category: "PERSON",
  title: "Meera",
  relationship: "Daughter",
  description: "Your eldest, who visits on Sundays.",
  hasImage: true,
  hasAudio: true,
};

const ANITA: LaneMemory = { ...MEERA, id: "m2", title: "Anita", relationship: "Sister" };
const POOL = [MEERA, ANITA];

describe("a miss shows the answer", () => {
  it("carries everything the correction needs to be said warmly", () => {
    const round = buildRound(MEERA, 0, POOL, identity);

    // "This is Meera." / "Your daughter." / the note — assembled into
    // the round, so the screen cannot render half of it or reach for
    // the raw record and print something the prompt was not about.
    expect(round.answer.title).toBe("Meera");
    expect(round.answer.relationship).toBe("Daughter");
    expect(round.answer.description).toBe("Your eldest, who visits on Sundays.");
  });

  it("says whether a familiar voice exists, so the offer is never empty", () => {
    expect(buildRound(MEERA, 0, POOL, identity).answer.hasAudio).toBe(true);
    expect(
      buildRound({ ...MEERA, hasAudio: false }, 0, POOL, identity).answer
        .hasAudio,
    ).toBe(false);
  });
});

describe("a missed memory comes back", () => {
  const rounds = [
    buildRound(MEERA, 4, POOL, identity),
    buildRound(ANITA, 0, POOL, identity),
  ];

  it("is re-presented later in the same sitting", () => {
    const next = appendRepeat(rounds, rounds[0], POOL, new Set(), identity);

    expect(next).toHaveLength(3);
    expect(next[2].memoryId).toBe("m1");
    // At the END, not next: an immediate repeat is a copying exercise,
    // whereas a few prompts later it is a real recall.
    expect(next[1].memoryId).toBe("m2");
  });

  it("comes back EASIER than the question that did not come", () => {
    const next = appendRepeat(rounds, rounds[0], POOL, new Set(), identity);
    expect(next[2].step).toBe(3);
    expect(next[2].step).toBeLessThan(rounds[0].step);
  });

  it("comes back once, never in a loop", () => {
    const next = appendRepeat(
      rounds,
      rounds[0],
      POOL,
      new Set(["m1"]),
      identity,
    );
    // A memory that has already had its repeat is not queued again —
    // a loop is something the one person least able to work out why
    // would be trapped in.
    expect(next).toHaveLength(2);
  });

  it("never steps below the gentlest question", () => {
    const first = buildRound(MEERA, 0, POOL, identity);
    const next = appendRepeat([first], first, POOL, new Set(), identity);
    expect(next[1].step).toBe(0);
  });

  it("does nothing, rather than throwing, if the memory has gone", () => {
    const next = appendRepeat(rounds, rounds[0], [ANITA], new Set(), identity);
    expect(next).toHaveLength(2);
  });

  it("does not mutate the rounds it was given", () => {
    const before = [...rounds];
    appendRepeat(rounds, rounds[0], POOL, new Set(), identity);
    expect(rounds).toEqual(before);
  });
});

describe("nothing Memory Lane says is negative", () => {
  /** Every key the Memory Lane screens can render. */
  const LANE_KEYS = [
    "laneTitle",
    "laneInvite",
    "laneSubtitle",
    "laneOpen",
    "laneJourneyCaption",
    "laneAskName",
    "laneAskRelationship",
    "laneThisIs",
    "laneYour",
    "laneComeBack",
    "laneNotSure",
    "laneHearVoice",
    "laneHear",
    "laneVoicePlaying",
    "laneDone",
    "laneDoneBody",
    "laneAgain",
    "laneEmptyTitle",
    "laneEmptyBody",
    "laneNothingDueTitle",
    "laneNothingDueBody",
    "navMemoryLane",
  ] as const satisfies readonly (keyof Dict)[];

  /**
   * Words that would tell somebody they had failed. Checked in all
   * three languages, because a kind English screen and a blunt
   * Assamese one is not a kind product.
   */
  const NEGATIVE: Record<string, string[]> = {
    EN: ["wrong", "incorrect", "failed", "failure", "error", "mistake", "no,"],
    HI: ["गलत", "ग़लत", "असफल", "गलती", "ग़लती"],
    AS: ["ভুল", "বিফল", "অশুদ্ধ"],
  };

  it("is fully translated in every language", () => {
    for (const language of LANGUAGES.map((l) => l.code)) {
      const dict = getDict(language);
      for (const key of LANE_KEYS) {
        expect(dict[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });

  it("does not leave Hindi or Assamese falling back to English", () => {
    const en = getDict("EN");
    for (const language of ["HI", "AS"] as const) {
      const dict = getDict(language);
      for (const key of LANE_KEYS) {
        expect(dict[key], `${language}.${key} is untranslated`).not.toBe(
          en[key],
        );
      }
    }
  });

  it("uses no word for failure, in any language", () => {
    for (const language of ["EN", "HI", "AS"] as const) {
      const dict = getDict(language);
      for (const key of LANE_KEYS) {
        const text = dict[key].toLowerCase();
        for (const word of NEGATIVE[language]) {
          expect(text, `${language}.${key} says "${word}"`).not.toContain(word);
        }
      }
    }
  });

  it("claims nothing medical", () => {
    for (const language of ["EN", "HI", "AS"] as const) {
      const dict = getDict(language);
      for (const key of LANE_KEYS) {
        expect(checkCopy(dict[key]).violations, `${language}.${key}`).toEqual(
          [],
        );
      }
    }
  });
});

describe("the screen itself shows no failure", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components", "elderly", "MemoryLane.tsx"),
    "utf8",
  );

  it("uses no error styling — there is no red anywhere in Memory Lane", () => {
    // A red border on the option somebody chose is the same message as
    // the word "wrong", delivered faster. The plain recall activity
    // does mark a wrong choice in red; Memory Lane deliberately does
    // not, and this is what keeps the two from converging.
    for (const cls of [
      "border-error",
      "bg-error",
      "text-error",
      "error-soft",
    ]) {
      expect(source, `MemoryLane.tsx uses ${cls}`).not.toContain(cls);
    }
  });

  it("does not render the shared wrong-answer feedback component", () => {
    expect(source).not.toContain("RoundFeedback");
    expect(source).not.toContain("notQuite");
  });
});
