import type { MemoryCategory } from "@prisma/client";

import { shuffle } from "@/lib/game-engine/random";

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

export interface MemoryOption {
  id: string;
  label: string;
}

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
const FILLER: Record<MemoryCategory, string[]> = {
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

function pickDistractors(
  target: MemoryItem,
  all: MemoryItem[],
): MemoryOption[] {
  const need = OPTIONS_PER_ROUND - 1;

  // Prefer other real memories, same category first, then any.
  const sameCategory = all.filter(
    (m) => m.id !== target.id && m.category === target.category,
  );
  const otherCategory = all.filter(
    (m) => m.id !== target.id && m.category !== target.category,
  );

  const pool: MemoryOption[] = [];
  const seenLabels = new Set([target.title.toLowerCase()]);

  for (const m of [...shuffle(sameCategory), ...shuffle(otherCategory)]) {
    if (pool.length >= need) break;
    const key = m.title.toLowerCase();
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);
    pool.push({ id: m.id, label: m.title });
  }

  // Top up from neutral filler if the person has few memories.
  for (const label of FILLER[target.category]) {
    if (pool.length >= need) break;
    if (seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());
    pool.push({ id: `filler-${label}`, label });
  }

  return pool.slice(0, need);
}
