import Link from "next/link";
import { ChevronRight, Check, Play, Sparkles } from "lucide-react";
import type { Language } from "@prisma/client";

import { LinkButton } from "@/components/ui/Button";
import { LeafSprig } from "@/components/ui/Decor";
import type { Dict } from "@/lib/i18n/dictionaries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { elderReasonFor } from "@/lib/intelligence/explanations";
import type { DailyPlan } from "@/lib/intelligence/types";
import { cn } from "@/lib/utils/cn";

/**
 * "Today's Journey" — the personalised plan on the home screen.
 *
 * Phase 6 changed what feeds this, not how it reads. The list comes
 * from the longitudinal intelligence layer (which balances practice
 * need against variety and recent success, and shortens the day when
 * activities have been hard work) rather than from the short-window
 * ordering alone.
 *
 * What the elder sees is unchanged in spirit: a short ordered list
 * and ONE primary button. No levels, no scores, no reasoning, no
 * mention of anything having been analysed. The personalisation is
 * meant to be felt, not read about.
 *
 * It is drawn as a walked path — a connecting line down the left,
 * finished steps behind you, the next one marked. That is a shape
 * people already understand, and it makes "three things today" feel
 * finite rather than like a list that could always grow.
 */
export function TodaysJourney({
  plan,
  completedGameIds,
  language,
  dict,
}: {
  plan: DailyPlan;
  completedGameIds: Set<string>;
  language: Language;
  dict: Dict;
}) {
  const pending = plan.activities;
  const done = [...completedGameIds];

  if (pending.length === 0 && done.length === 0) return null;

  const target = pending[0] ?? null;
  const totalSteps = done.length + pending.length;

  return (
    <section className="panel relative isolate overflow-hidden p-5 sm:p-7">
      {/* Kept to the bottom corner and very faint: decoration that
          crosses a line of text is decoration that has failed. */}
      <LeafSprig className="pointer-events-none absolute -right-10 -bottom-10 !size-48 rotate-[18deg] opacity-[0.12]" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
            {dict.journeyTitle}
          </h2>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-base font-semibold text-warning">
            <Sparkles className="size-4 shrink-0" aria-hidden />
            {dict.chosenForYou}
          </span>
        </div>
        <p className="mt-1.5 text-lg text-text-muted">
          {/* A lighter day is announced warmly, never as a limitation. */}
          {plan.gentler ? dict.journeyGentleDay : dict.journeySubtitle}
        </p>

        <ol className="relative mt-6 flex flex-col">
          {/* Finished first, so the day reads as progress already made. */}
          {done.map((gameId, index) => (
            <JourneyStep
              key={gameId}
              gameId={gameId}
              index={index}
              total={totalSteps}
              caption={dict.journeyDone}
              language={language}
              state="done"
            />
          ))}

          {pending.map((activity, index) => (
            <JourneyStep
              key={activity.gameId}
              gameId={activity.gameId}
              index={done.length + index}
              total={totalSteps}
              caption={`${dict.gameMinutesShort.replace(
                "{n}",
                String(activity.estimatedMinutes),
              )} · ${elderReasonFor(activity, dict)}`}
              status={index === 0 ? dict.journeyUpNext : dict.journeyLater}
              language={language}
              state={index === 0 ? "next" : "later"}
            />
          ))}
        </ol>

        <div className="mt-6">
          {target ? (
            <LinkButton
              href={`/games/${target.gameId}`}
              size="xl"
              fullWidth
              icon={<Play className="size-6 shrink-0" aria-hidden />}
            >
              {done.length > 0 ? dict.journeyContinue : dict.journeyStart}
            </LinkButton>
          ) : (
            <p className="flex items-center justify-center gap-2.5 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-lg font-semibold text-success">
              <Check className="size-6 shrink-0" aria-hidden />
              {dict.journeyAllDone}
            </p>
          )}
        </div>

        {/* An optional extra, offered and never required. */}
        {plan.optionalExtra && pending.length > 0 ? (
          <p className="mt-4 text-center">
            <Link
              href={`/games/${plan.optionalExtra.gameId}`}
              className="inline-block rounded-lg px-2 py-1 text-base font-semibold text-text-muted underline underline-offset-4 transition-colors hover:text-primary"
            >
              {dict.journeyOptionalExtra}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

type StepState = "done" | "next" | "later";

function JourneyStep({
  gameId,
  index,
  total,
  caption,
  status,
  language,
  state,
}: {
  gameId: string;
  index: number;
  total: number;
  caption: string;
  status?: string;
  language: Language;
  state: StepState;
}) {
  const definition = getDefinition(gameId);
  const isLast = index === total - 1;

  return (
    <li className="relative flex gap-4 pb-3 last:pb-0">
      {/* The path itself. Solid behind you, dotted ahead of you. */}
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-14 bottom-1 left-[1.6875rem] w-0.5 rounded-full",
            state === "done" ? "bg-success/40" : "bg-border",
          )}
        />
      ) : null}

      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-0.5 flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl",
          state === "done"
            ? "border-success/35 bg-success-soft"
            : state === "next"
              ? "border-primary/40 bg-primary-soft shadow-soft"
              : "border-border bg-surface-alt",
        )}
      >
        {state === "done" ? (
          <Check className="size-7 text-success" strokeWidth={2.6} />
        ) : (
          (definition?.glyph ?? "🧠")
        )}
      </span>

      <Link
        href={`/games/${gameId}`}
        className={cn(
          "panel-interactive group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3.5",
          state === "done"
            ? "border-success/25 bg-success-soft/40"
            : state === "next"
              ? "border-border-strong bg-surface shadow-soft"
              : "border-border bg-surface-alt/60",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={cn(
                "text-lg leading-tight font-semibold",
                state === "later" && "text-text-muted",
              )}
            >
              {definition?.name[language] ?? gameId}
            </span>
            {status ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-sm font-semibold",
                  state === "next"
                    ? "bg-primary text-text-inverse"
                    : "bg-surface-sunken text-text-muted",
                )}
              >
                {status}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 text-base text-text-muted">{caption}</span>
        </span>

        <ChevronRight
          className="size-6 shrink-0 text-text-muted transition-transform duration-200 ease-gentle group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}
