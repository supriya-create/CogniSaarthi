import type { CognitiveDomain, Difficulty } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * Enum-to-copy lookups, kept in one place so a difficulty is worded
 * identically on the picker, the result screen and the history list.
 */

export const DIFFICULTY_KEYS: Record<Difficulty, keyof Dict> = {
  EASY: "difficultyEasy",
  MEDIUM: "difficultyMedium",
  HARD: "difficultyHard",
};

export function difficultyLabel(
  difficulty: Difficulty,
  dict: Dict,
): string {
  return dict[DIFFICULTY_KEYS[difficulty]];
}

export function domainLabel(
  domain: CognitiveDomain,
  dict: Dict,
): string | undefined {
  return dict[`domain${domain}` as keyof Dict] as string | undefined;
}
