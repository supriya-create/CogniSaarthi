import Link from "next/link";
import { ChevronRight, CircleCheck, Play } from "lucide-react";
import type { Language } from "@prisma/client";

import { LinkButton } from "@/components/ui/Button";
import type { Dict } from "@/lib/i18n/dictionaries";
import { getDefinition } from "@/lib/game-engine/definitions";
import type { JourneyActivity } from "@/lib/cognitive-performance/types";
import { cn } from "@/lib/utils/cn";

const REASON_KEY: Record<JourneyActivity["reason"], keyof Dict> = {
  needsPractice: "journeyReasonNeedsPractice",
  keepSteady: "journeyReasonKeepSteady",
  forEnjoyment: "journeyReasonForEnjoyment",
};

/**
 * "Today's Journey" — the personalised plan on the home screen.
 *
 * It shows a short, ordered list of activities chosen for the person
 * (weaker areas lead) and ONE primary button that starts the first
 * one they have not done today. It deliberately does not show levels,
 * scores or any of the engine's reasoning: the personalisation is
 * meant to be felt, not read about. The difficulty for each activity
 * is decided when it opens, by the same engine.
 */
export function TodaysJourney({
  journey,
  completedGameIds,
  language,
  dict,
}: {
  journey: JourneyActivity[];
  completedGameIds: Set<string>;
  language: Language;
  dict: Dict;
}) {
  if (journey.length === 0) return null;

  const firstPending = journey.find((a) => !completedGameIds.has(a.gameId));
  const target = firstPending ?? journey[0];
  const allDone = firstPending === undefined;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline gap-2">
        <h2 className="font-serif text-2xl font-semibold">
          {dict.journeyTitle}
        </h2>
        <span aria-hidden className="text-2xl">
          🌼
        </span>
      </div>
      <p className="mt-1 text-lg text-text-muted">{dict.journeySubtitle}</p>

      <ol className="mt-5 flex flex-col gap-2.5">
        {journey.map((activity) => {
          const definition = getDefinition(activity.gameId);
          const done = completedGameIds.has(activity.gameId);
          return (
            <li key={activity.gameId}>
              <Link
                href={`/games/${activity.gameId}`}
                className={cn(
                  "flex items-center gap-4 rounded-xl border p-3.5 transition-colors duration-150",
                  done
                    ? "border-success/30 bg-success-soft/50"
                    : "border-border bg-surface-alt/50 hover:border-border-strong hover:bg-surface-alt",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-2xl"
                >
                  {definition?.glyph ?? "🧠"}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-semibold leading-tight">
                    {definition?.name[language] ?? activity.gameId}
                  </span>
                  <span className="mt-0.5 text-base text-text-muted">
                    {activity.estimatedMinutes} {dict.unitMinute} ·{" "}
                    {dict[REASON_KEY[activity.reason]]}
                  </span>
                </span>

                {done ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-base font-semibold text-success">
                    <CircleCheck className="size-5" aria-hidden />
                    {dict.journeyDone}
                  </span>
                ) : (
                  <ChevronRight
                    className="size-6 shrink-0 text-text-muted"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-5">
        <LinkButton
          href={`/games/${target.gameId}`}
          fullWidth
          icon={<Play className="size-6 shrink-0" aria-hidden />}
        >
          {allDone ? dict.playAnother : dict.journeyStart}
        </LinkButton>
      </div>
    </section>
  );
}
