import { Clock, SlidersHorizontal } from "lucide-react";

import { Stars } from "@/components/ui/Stars";
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
 * previous attempt, no "below average". The plain counts sit
 * underneath for anyone who wants them.
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
    <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-soft">
      <p className="animate-pop font-serif text-4xl leading-tight font-semibold">
        {dict[TONE_KEYS[tone]]}
      </p>

      <p className="mx-auto mt-4 max-w-sm text-xl leading-relaxed text-text-muted">
        {summary}
      </p>

      <div className="mt-6 flex justify-center">
        <Stars
          count={stars}
          label={dict.resultStarsLabel}
          ofLabel={dict.ofTotal}
        />
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-xl border border-border bg-surface-alt p-4">
          <dt className="flex items-center gap-2 text-base text-text-muted">
            <Clock className="size-5 shrink-0" aria-hidden />
            {dict.resultTimeTaken}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatDuration(durationMs, {
              minute: dict.unitMinute,
              second: dict.unitSecond,
            })}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-surface-alt p-4">
          <dt className="flex items-center gap-2 text-base text-text-muted">
            <SlidersHorizontal className="size-5 shrink-0" aria-hidden />
            {dict.resultLevel}
          </dt>
          <dd className="mt-1 text-xl font-semibold">{difficultyLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
