import { Lightbulb } from "lucide-react";

import { getDefinition } from "@/lib/game-engine/definitions";
import { explainRecommendationForCaregiver } from "@/lib/intelligence/explanations";
import type { DailyPlan } from "@/lib/intelligence/types";

/**
 * What Cognisaarthi is suggesting next, and WHY.
 *
 * This panel exists because the product promises that personalisation
 * can always be explained. A caregiver who wonders why their mother was
 * offered the same activity twice this week should be able to read the
 * actual reason, in plain English, rather than take it on trust.
 *
 * The elder never sees any of this — they just see the activity.
 */
export function SuggestedNext({
  plan,
  userName,
}: {
  plan: DailyPlan;
  userName: string;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-warning"
        >
          <Lightbulb className="size-5" />
        </span>
        <h2 className="font-serif text-2xl font-semibold">
          Suggested for {userName} today
        </h2>
      </div>

      {plan.gentler ? (
        <p className="mt-4 max-w-2xl rounded-2xl border border-border bg-surface-alt px-5 py-4 text-base leading-relaxed text-text-muted">
          Today&apos;s plan is deliberately shorter — recent activities have
          either been hard work or there has been a gap since the last one, so
          Cognisaarthi is asking less rather than more.
        </p>
      ) : null}

      {plan.activities.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-base font-medium text-success">
          {userName} has completed today&apos;s suggested activities.
        </p>
      ) : (
        <ol className="mt-5 flex flex-col gap-3">
          {plan.activities.map((activity, index) => {
            const definition = getDefinition(activity.gameId);
            const name = definition?.name.EN ?? activity.gameId;
            return (
              <li
                key={activity.gameId}
                className="panel flex gap-4 p-4 sm:p-5"
              >
                <span
                  aria-hidden
                  className="numeric flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary-soft font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{name}</p>
                  <p className="mt-0.5 text-base leading-relaxed text-text-muted">
                    {explainRecommendationForCaregiver(activity, name)}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Opens at the {activity.difficulty.toLowerCase()} level.
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {plan.optionalExtra ? (
        <p className="mt-3 text-sm text-text-muted">
          An optional extra activity is offered if {userName} wants to keep
          going. It is never presented as required.
        </p>
      ) : null}
    </section>
  );
}
