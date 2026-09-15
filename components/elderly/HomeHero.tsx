import { CircleCheck } from "lucide-react";

import { ProgressRing } from "@/components/elderly/ProgressRing";
import { GlowDecor, HillsDecor, LeafSprig } from "@/components/ui/Decor";

/**
 * The first thing on the home screen, and the emotional register for
 * the whole app: a greeting by name, one warm line, and the day's
 * progress as a ring.
 *
 * What it does NOT contain is as deliberate as what it does. No
 * score, no percentage, no streak to break, no "you missed two
 * days". Progress here is a count of activities finished today and a
 * sentence of encouragement — nothing an anxious person could read
 * as a verdict on how their memory is doing.
 */
export function HomeHero({
  greeting,
  name,
  invite,
  dateLabel,
  completed,
  goal,
  goalMet,
  goalMetLine,
  progressLine,
  progressLabel,
  ofLabel,
}: {
  greeting: string;
  name: string;
  invite: string;
  dateLabel: string;
  completed: number;
  goal: number;
  goalMet: boolean;
  goalMetLine: string;
  progressLine: string;
  progressLabel: string;
  ofLabel: string;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/70">
      {/* Layered, very quiet decoration: two washes of brand colour,
          a sprig of tea leaf, and the hills along the bottom edge. */}
      <GlowDecor className="-top-24 -left-24 size-96" tone="primary" />
      <GlowDecor className="-top-32 right-0 size-80" tone="secondary" />
      <LeafSprig className="absolute -top-14 -right-10 !size-56 rotate-12 opacity-[0.13] sm:-right-4 sm:!size-72" />
      <HillsDecor />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pt-8 pb-12 sm:px-6 sm:pt-10 sm:pb-14">
        <div className="flex items-start justify-between gap-5 sm:gap-8">
          <div className="min-w-0 animate-fade-up">
            <p className="text-base font-semibold tracking-[0.1em] text-text-muted uppercase">
              {dateLabel}
            </p>
            <h1 className="mt-2.5 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
              {greeting},{" "}
              <span className="text-primary">{name}</span>
            </h1>
            <p className="mt-3 max-w-md text-xl leading-relaxed text-text-muted">
              {invite}
            </p>
          </div>

          <ProgressRing
            completed={completed}
            goal={goal}
            label={progressLabel}
            ofLabel={ofLabel}
            className="mt-1 !size-20 sm:!size-28"
          />
        </div>

        <p
          className={
            goalMet
              ? "flex items-center gap-2.5 text-lg font-semibold text-success"
              : "text-lg text-text-muted"
          }
        >
          {goalMet ? (
            <CircleCheck className="size-6 shrink-0" aria-hidden />
          ) : null}
          {goalMet ? goalMetLine : progressLine}
        </p>
      </div>
    </section>
  );
}
