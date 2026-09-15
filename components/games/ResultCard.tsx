import { Clock, SlidersHorizontal, Target } from "lucide-react";

import { Stars } from "@/components/ui/Stars";
import { GlowDecor, HillsDecor } from "@/components/ui/Decor";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { ResultTone } from "@/lib/game-engine/scoring";
import { formatDuration } from "@/lib/utils/date";

const TONE_KEYS: Record<ResultTone, keyof Dict> = {
  wonderful: "resultWonderful",
  wellDone: "resultWellDone",
  niceWork: "resultNiceWork",
  goodTry: "resultGoodTry",
};

/**
 * The result, written as a sentence someone would actually say.
 *
 * No percentage in the headline, no chart, no comparison against a
 * previous attempt, no "below average". This is a finishing screen,
 * not a report card — the stars and the sentence come first, and the
 * plain counts sit underneath for anyone who wants them.
 *
 * The celebration is one scale-in and a row of stars. Anything more
 * (confetti, sounds, a bouncing trophy) reads as a slot machine and
 * is exactly the wrong note for someone who may be anxious about how
 * they did.
 */
export function ResultCard({
  tone,
  stars,
  correctCount,
  totalCount,
  durationMs,
  difficultyLabel,
  dict,
}: {
  tone: ResultTone;
  stars: number;
  correctCount: number;
  totalCount: number;
  durationMs: number;
  difficultyLabel: string;
  dict: Dict;
}) {
  const summary = dict.resultSummary
    .replace("{correct}", String(correctCount))
    .replace("{total}", String(totalCount));

  return (
    <div className="panel relative isolate overflow-hidden px-6 py-9 text-center sm:px-8 sm:py-11">
      <GlowDecor className="-top-20 left-1/2 size-72 -translate-x-1/2" tone="accent" />
      <HillsDecor className="h-20 opacity-70" />

      <div className="relative">
        {/* The medallion: stars held inside a soft ring. */}
        <div className="animate-pop mx-auto flex size-28 items-center justify-center rounded-full border-2 border-accent/30 bg-accent-soft shadow-lift sm:size-32">
          <span className="font-serif text-5xl leading-none font-semibold text-warning sm:text-6xl">
            {stars}
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <Stars
            count={stars}
            label={dict.resultStarsLabel}
            ofLabel={dict.ofTotal}
          />
        </div>

        <p className="animate-fade-up mt-6 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
          {dict[TONE_KEYS[tone]]}
        </p>

        <p className="animate-fade-up mx-auto mt-3 max-w-sm text-xl leading-relaxed text-text-muted">
          {summary}
        </p>

        <dl className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          <Stat
            Icon={Target}
            label={dict.resultAccuracy}
            value={`${correctCount} / ${totalCount}`}
          />
          <Stat
            Icon={Clock}
            label={dict.resultTimeTaken}
            value={formatDuration(durationMs, {
              minute: dict.unitMinute,
              second: dict.unitSecond,
            })}
          />
          <Stat
            Icon={SlidersHorizontal}
            label={dict.resultLevel}
            value={difficultyLabel}
          />
        </dl>
      </div>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
}: {
  Icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-alt/70 p-4">
      <dt className="flex items-center gap-2 text-base text-text-muted">
        <Icon className="size-5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="numeric mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}
