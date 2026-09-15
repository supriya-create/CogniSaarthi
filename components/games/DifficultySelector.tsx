"use client";

import { Check } from "lucide-react";
import type { Difficulty } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import { DIFFICULTIES } from "@/lib/game-engine/definitions";
import { cn } from "@/lib/utils/cn";

const LABEL_KEYS: Record<Difficulty, { name: keyof Dict; help: keyof Dict }> = {
  EASY: { name: "difficultyEasy", help: "difficultyEasyHelp" },
  MEDIUM: { name: "difficultyMedium", help: "difficultyMediumHelp" },
  HARD: { name: "difficultyHard", help: "difficultyHardHelp" },
};

/**
 * Three levels, described by what they feel like rather than by a
 * number of items. "A gentle start" tells someone more than "3".
 */
export function DifficultySelector({
  value,
  onChange,
  dict,
}: {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  dict: Dict;
}) {
  return (
    <div role="radiogroup" aria-label={dict.chooseDifficulty} className="flex flex-col gap-3">
      {DIFFICULTIES.map((difficulty) => {
        const selected = value === difficulty;
        const keys = LABEL_KEYS[difficulty];

        return (
          <label
            key={difficulty}
            className={cn(
              "flex min-h-[4.25rem] cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4",
              "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out-soft",
              selected
                ? "border-primary bg-primary-soft shadow-lift"
                : "border-border bg-surface shadow-soft hover:border-border-strong hover:bg-surface-alt",
            )}
          >
            <input
              type="radio"
              name="difficulty"
              value={difficulty}
              checked={selected}
              onChange={() => onChange(difficulty)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                selected
                  ? "border-primary bg-primary text-text-inverse"
                  : "border-border-strong bg-surface",
              )}
            >
              {selected ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xl font-semibold leading-tight">
                {dict[keys.name]}
              </span>
              <span className="text-base text-text-muted">
                {dict[keys.help]}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
