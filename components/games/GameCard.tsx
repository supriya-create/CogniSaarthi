import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import type { Language } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { GameDefinition } from "@/lib/game-engine/types";
import { ESTIMATED_MINUTES_PER_ACTIVITY } from "@/lib/cognitive-performance/config";
import { cn } from "@/lib/utils/cn";

/**
 * Colour is assigned per activity so a column of them has a rhythm
 * and so people come to recognise "the green one" before they read
 * the name.
 */
const ACCENTS = {
  primary: {
    plate: "bg-primary-soft border-primary/25",
    wash: "from-primary-tint",
  },
  secondary: {
    plate: "bg-secondary-soft border-secondary/25",
    wash: "from-secondary-soft/50",
  },
  tea: {
    plate: "bg-accent-soft border-accent/30",
    wash: "from-accent-soft/50",
  },
} as const;

/**
 * An activity in the picker. The whole card is the link — a small
 * "Play" button inside a large card is a target people miss — but a
 * play affordance is still drawn, because a card that is silently
 * clickable is a card people do not click.
 *
 * What is shown: the name, one friendly sentence, roughly how long it
 * takes, and what it is good for in ordinary words. What is NOT
 * shown: the difficulty the engine has chosen, the mastery estimate,
 * the confidence interval, or the trend. Those exist, they drive what
 * happens next, and they belong on the caregiver's screen.
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
  const benefit = dict[`benefit${game.domain}` as keyof Dict] as
    | string
    | undefined;
  const accent = ACCENTS[game.accent];
  const minutes = dict.gameMinutesShort.replace(
    "{n}",
    String(ESTIMATED_MINUTES_PER_ACTIVITY),
  );

  return (
    <Link
      href={`/games/${game.id}`}
      className="panel-interactive group relative isolate flex items-stretch gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-soft sm:gap-5 sm:p-6"
    >
      {/* A wash of the activity's own colour, bled in from the left. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/3 bg-gradient-to-r to-transparent opacity-70",
          accent.wash,
        )}
      />

      <span
        aria-hidden
        className={cn(
          "flex size-20 shrink-0 items-center justify-center self-start rounded-2xl border text-4xl shadow-soft transition-transform duration-200 ease-out-soft group-hover:scale-105 sm:size-24 sm:text-5xl",
          accent.plate,
        )}
      >
        {game.glyph}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-serif text-xl leading-tight font-semibold sm:text-2xl">
          {game.name[language]}
        </span>

        <span className="mt-1.5 text-base leading-snug text-text-muted">
          {game.shortDescription[language]}
        </span>

        <span className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            tone="neutral"
            size="sm"
            icon={<Clock className="size-4 shrink-0" aria-hidden />}
          >
            {minutes}
          </Badge>
          {benefit ? (
            <Badge tone="primary" size="sm">
              {benefit}
            </Badge>
          ) : null}
          {done ? (
            <Badge
              tone="success"
              size="sm"
              icon={<Check className="size-4 shrink-0" aria-hidden />}
            >
              {dict.gamePlayedToday}
            </Badge>
          ) : null}
        </span>

        <span className="mt-4 inline-flex items-center gap-2 text-base font-bold text-primary">
          {dict.gamePlayAction}
          <ArrowRight
            className="size-5 transition-transform duration-200 ease-gentle group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}
