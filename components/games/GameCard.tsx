import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Language } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import type { GameDefinition } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils/cn";

const ACCENTS = {
  primary: "bg-primary-soft border-primary/20",
  secondary: "bg-secondary-soft border-secondary/20",
  tea: "bg-accent-soft border-accent/30",
} as const;

/**
 * An activity in the picker. The whole card is the link — a small
 * "Play" button inside a large card is a target people miss.
 */
export function GameCard({
  game,
  language,
  dict,
  done,
}: {
  game: GameDefinition<unknown>;
  language: Language;
  dict: Dict;
  done?: boolean;
}) {
  const domainLabel = dict[`domain${game.domain}` as keyof Dict] as
    | string
    | undefined;

  return (
    <Link
      href={`/games/${game.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-colors duration-150 ease-gentle hover:border-border-strong hover:bg-surface-alt"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-2xl border text-3xl",
          ACCENTS[game.accent],
        )}
      >
        {game.glyph}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-serif text-xl font-semibold leading-tight">
            {game.name[language]}
          </span>
          {domainLabel ? (
            <span className="rounded-full border border-border bg-surface-alt px-2.5 py-0.5 text-sm font-medium text-text-muted">
              {domainLabel}
            </span>
          ) : null}
          {done ? (
            <span className="rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-sm font-semibold text-success">
              ✓ {dict.historyCompleted}
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 text-base leading-snug text-text-muted">
          {game.shortDescription[language]}
        </span>
      </span>

      <ChevronRight
        className="size-7 shrink-0 text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
