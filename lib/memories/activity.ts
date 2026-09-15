import type { MemoryCategory } from "@prisma/client";

import { shuffle } from "@/lib/game-engine/random";
import { buildDistractors, type LabelledOption } from "@/lib/memories/options";

/**
 * Building recall rounds from a person's own memories. Pure and
 * testable — no DB, no React. The activity is gentle recognition:
 * show a photo, ask a simple question, offer a few options one of
 * which is the real answer.
 *
 * Only memories that have a photo are used. Distractor options are
 * drawn from the person's OTHER memories where possible (more
 * meaningful than random words), topped up from a small neutral pool
 * so there are always a few choices.
 */

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  title: string;
  relationship: string | null;
  hasImage: boolean;
}

export type MemoryPromptKey =
  | "memoryWhoIsThis"
  | "memoryWhatPlace"
  | "memoryWhatThing"
  | "memoryWhatMoment";

export type MemoryOption = LabelledOption;

export interface MemoryRound {
  memoryId: string;
  category: MemoryCategory;
  promptKey: MemoryPromptKey;
  correctLabel: string;
  /** Labels accepted for a spoken answer (title, and relationship). */
  acceptedAnswers: string[];
  options: MemoryOption[];
}

const PROMPT: Record<MemoryCategory, MemoryPromptKey> = {
  PERSON: "memoryWhoIsThis",
  PLACE: "memoryWhatPlace",
  THING: "memoryWhatThing",
  MOMENT: "memoryWhatMoment",
};

/** Neutral filler names/labels, only used when a person has too few
 *  memories to supply distractors. Kept ordinary and non-specific. */
export const FILLER: Record<MemoryCategory, string[]> = {
  PERSON: ["Ramen", "Bina", "Anil", "Mira", "Gopal"],
  PLACE: ["The market", "The garden", "The temple", "The river"],
  THING: ["A cup", "A book", "A basket", "A lamp"],
  MOMENT: ["A festival", "A visit", "A morning walk", "A meal together"],
};

const OPTIONS_PER_ROUND = 3;
const DEFAULT_MAX_ROUNDS = 5;

export function buildMemoryRounds(
  items: MemoryItem[],
  maxRounds = DEFAULT_MAX_ROUNDS,
): MemoryRound[] {
  const usable = items.filter((item) => item.hasImage && item.title.trim());
  const chosen = shuffle(usable).slice(0, maxRounds);

  return chosen.map((item) => {
    const distractors = pickDistractors(item, usable);
    const options = shuffle([
      { id: item.id, label: item.title },
      ...distractors,
    ]);

    const acceptedAnswers = [item.title];
    if (item.relationship) acceptedAnswers.push(item.relationship);

    return {
      memoryId: item.id,
      category: item.category,
      promptKey: PROMPT[item.category],
      correctLabel: item.title,
      acceptedAnswers,
      options,
    };
  });
}

/**
 * Distractors for one round.
 *
 * The rule itself lives in `options.ts` and is shared with Memory
 * Lane, which asks the same shaped question over different labels.
 * This function only says what "similar" and "label" mean HERE: same
 * category, and the memory's title.
 */
function pickDistractors(
  target: MemoryItem,
  all: MemoryItem[],
): MemoryOption[] {
  return buildDistractors(
    {
      target,
      pool: all,
      idOf: (item) => item.id,
      labelOf: (item) => item.title,
      isSimilar: (item, t) => item.category === t.category,
      filler: FILLER[target.category],
      count: OPTIONS_PER_ROUND,
    },
    shuffle,
  );
}
