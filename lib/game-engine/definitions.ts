import type { Difficulty } from "@prisma/client";

import type { GameDefinition, GameId } from "@/lib/game-engine/types";
import type { Similarity } from "@/lib/game-engine/content/odd-one-out";

/**
 * The catalogue. This module is pure data with no React imports, so
 * server components, the seed script and client components can all
 * read it.
 *
 * Difficulty here is a fixed, deterministic table — three named
 * presets per game. It is NOT adaptive and is not described to the
 * user as intelligent. Phase 2 replaces the lookup below with an
 * engine that chooses a preset from a person's history; nothing
 * outside this file needs to change when it does.
 */

// ---------------------------------------------------------------
// Per-game configuration shapes
// ---------------------------------------------------------------

export interface RememberObjectsConfig {
  /** How many objects to memorise. */
  itemCount: number;
  /** Extra objects mixed into the answer grid. */
  distractorCount: number;
  /** How long the objects stay on screen. */
  viewSeconds: number;
}

export interface FindDifferentConfig {
  rounds: number;
  /** Total tiles in the grid, including the odd one. */
  tileCount: number;
  similarity: Similarity;
}

export interface RememberSequenceConfig {
  rounds: number;
  sequenceLength: number;
  /** How long each step of the sequence is shown. */
  stepMs: number;
  /** Extra objects added to the answer palette. */
  paletteExtra: number;
}

// ---------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------

export const REMEMBER_OBJECTS: GameDefinition<RememberObjectsConfig> = {
  id: "remember-objects",
  domain: "SHORT_TERM_MEMORY",
  iconKey: "brain",
  accent: "primary",
  glyph: "🧺",
  name: {
    EN: "Remember the Objects",
    HI: "चीज़ें याद रखें",
    AS: "বস্তুবোৰ মনত ৰাখক",
  },
  shortDescription: {
    EN: "Look at a few everyday things, then pick out the ones you saw.",
    HI: "कुछ रोज़ की चीज़ें देखिए, फिर उन्हें पहचानिए।",
    AS: "কেইটামান দৈনন্দিন বস্তু চাওক, তাৰ পিছত সেইবোৰ বাছি উলিয়াওক।",
  },
  instructions: {
    EN: "Some everyday objects will appear for a short while. Look at them carefully. When they disappear, tap the ones you remember.",
    HI: "कुछ रोज़मर्रा की चीज़ें थोड़ी देर के लिए दिखेंगी। उन्हें ध्यान से देखिए। जब वे गायब हो जाएँ, तो जो आपको याद हैं उन्हें छुइए।",
    AS: "কিছু দৈনন্দিন বস্তু অলপ সময়ৰ বাবে দেখা যাব। সেইবোৰ ভালদৰে চাওক। সেইবোৰ নোহোৱা হ'লে, আপুনি মনত ৰখাবোৰত টিপক।",
  },
  difficulties: {
    EASY: { itemCount: 3, distractorCount: 3, viewSeconds: 8 },
    MEDIUM: { itemCount: 5, distractorCount: 4, viewSeconds: 10 },
    HARD: { itemCount: 7, distractorCount: 5, viewSeconds: 12 },
  },
};

export const FIND_DIFFERENT: GameDefinition<FindDifferentConfig> = {
  id: "find-different",
  domain: "ATTENTION",
  iconKey: "search",
  accent: "secondary",
  glyph: "🔍",
  name: {
    EN: "Find the Different One",
    HI: "अलग वाला ढूँढें",
    AS: "বেলেগটো বিচাৰক",
  },
  shortDescription: {
    EN: "One picture in the group is not like the others. Spot it.",
    HI: "इस समूह में एक तस्वीर बाकियों से अलग है। उसे पहचानिए।",
    AS: "দলটোৰ এখন ছবি আনবোৰৰ দৰে নহয়। সেইখন বিচাৰি উলিয়াওক।",
  },
  instructions: {
    EN: "You will see a group of pictures. All of them are the same except one. Tap the one that is different.",
    HI: "आपको तस्वीरों का एक समूह दिखेगा। एक को छोड़कर सब एक जैसी हैं। जो अलग है उसे छुइए।",
    AS: "আপুনি একে ধৰণৰ কিছু ছবি দেখিব। এখনৰ বাহিৰে বাকীবোৰ একে। যিখন বেলেগ, সেইখনত টিপক।",
  },
  difficulties: {
    EASY: { rounds: 5, tileCount: 6, similarity: "low" },
    MEDIUM: { rounds: 5, tileCount: 9, similarity: "medium" },
    HARD: { rounds: 6, tileCount: 16, similarity: "high" },
  },
};

export const REMEMBER_SEQUENCE: GameDefinition<RememberSequenceConfig> = {
  id: "remember-sequence",
  domain: "WORKING_MEMORY",
  iconKey: "list-ordered",
  accent: "tea",
  glyph: "🔢",
  name: {
    EN: "Remember the Sequence",
    HI: "क्रम याद रखें",
    AS: "ক্ৰমটো মনত ৰাখক",
  },
  shortDescription: {
    EN: "Watch pictures appear one by one, then repeat them in order.",
    HI: "तस्वीरें एक-एक करके देखिए, फिर उसी क्रम में दोहराइए।",
    AS: "ছবিবোৰ এটা এটাকৈ চাওক, তাৰ পিছত সেই ক্ৰমতে দোহৰাওক।",
  },
  instructions: {
    EN: "Pictures will appear one after another. Watch the order they come in. Then tap them in the same order.",
    HI: "तस्वीरें एक के बाद एक आएँगी। उनका क्रम देखिए। फिर उसी क्रम में उन्हें छुइए।",
    AS: "ছবিবোৰ এটাৰ পিছত এটাকৈ আহিব। সেইবোৰৰ ক্ৰমটো চাওক। তাৰ পিছত সেই একে ক্ৰমতে টিপক।",
  },
  difficulties: {
    EASY: { rounds: 3, sequenceLength: 3, stepMs: 1100, paletteExtra: 3 },
    MEDIUM: { rounds: 3, sequenceLength: 4, stepMs: 950, paletteExtra: 4 },
    HARD: { rounds: 4, sequenceLength: 5, stepMs: 800, paletteExtra: 5 },
  },
};

export const GAME_DEFINITIONS = [
  REMEMBER_OBJECTS,
  FIND_DIFFERENT,
  REMEMBER_SEQUENCE,
] as const;

const BY_ID = new Map<string, GameDefinition<unknown>>(
  GAME_DEFINITIONS.map((g) => [g.id, g as GameDefinition<unknown>]),
);

export function getDefinition(id: string): GameDefinition<unknown> | undefined {
  return BY_ID.get(id);
}

export function isGameId(id: string): id is GameId {
  return BY_ID.has(id);
}

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/**
 * How many rounds a game runs at a difficulty. Derived from the
 * preset so the server can record `roundsTotal` without taking the
 * client's word for it. Games with a single pass omit `rounds`.
 */
export function roundCountFor(id: string, difficulty: Difficulty): number {
  const config = getDefinition(id)?.difficulties[difficulty];
  if (config && typeof config === "object" && "rounds" in config) {
    const rounds = (config as { rounds: unknown }).rounds;
    if (typeof rounds === "number") return rounds;
  }
  return 1;
}

// Phase 1 shipped a static `defaultDifficulty()` here. Phase 2
// replaced it with the history-driven recommendation in
// lib/cognitive-performance (see getRecommendedDifficulty), so the
// static version has been removed rather than left as dead code.
