import {
  ArrowRight,
  CircleHelp,
  MoveDownRight,
  MoveUpRight,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DOMAIN_LABEL } from "@/lib/intelligence/domains";
import {
  explainRoutine,
  explainTrend,
  trendClassLabel,
} from "@/lib/intelligence/explanations";
import { confidenceLabel } from "@/lib/intelligence/confidence";
import { isReportableTrend } from "@/lib/intelligence/trends";
import type {
  ActivityRoutine,
  LongitudinalDomainProfile,
  TrendClass,
} from "@/lib/intelligence/types";

/**
 * Longitudinal trends for the caregiver.
 *
 * Three rules shape this panel:
 *
 *  1. It shows a direction ONLY when there is enough recent activity to
 *     support one. Otherwise it says so plainly, rather than drawing a
 *     confident-looking arrow over three sessions.
 *  2. Every direction carries an icon AND a word, never colour alone —
 *     the same accessibility rule the rest of the product follows.
 *  3. Every sentence describes how the ACTIVITIES went. Nothing here
 *     is a statement about the person's health, and the copy is checked
 *     against the medical-language guard by test.
 */

const TREND_ICON: Record<TrendClass, LucideIcon> = {
  IMPROVING: MoveUpRight,
  DECLINING: MoveDownRight,
  STABLE: ArrowRight,
  VARIABLE: Waves,
  INSUFFICIENT_DATA: CircleHelp,
};

/** Pill styling per direction. The word inside the pill is what
    carries the meaning; this only makes it quicker to scan. */
const TREND_TONE: Record<TrendClass, string> = {
  IMPROVING: "border-success/25 bg-success-soft text-success",
  DECLINING: "border-warning/30 bg-warning-soft text-warning",
  STABLE: "border-border bg-surface-alt text-text-muted",
  VARIABLE: "border-secondary/25 bg-secondary-soft text-secondary",
  INSUFFICIENT_DATA: "border-border bg-surface-alt text-text-muted",
};

export function CognitiveTrends({
  profiles,
  routine,
  userName,
}: {
  profiles: LongitudinalDomainProfile[];
  routine: ActivityRoutine;
  userName: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold">
        How {userName}&apos;s activities are going
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
        Longer-term patterns across the activities {userName} has done. These
        describe the activities themselves, not a health measurement.
      </p>

      {/* Activity routine — a regularity measure, never a health score. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RoutineTile
          label="Active days"
          value={`${routine.activeDays} / ${routine.daysInWindow}`}
          hint={`Last ${routine.daysInWindow} days`}
        />
        <RoutineTile
          label="Activities a week"
          value={String(routine.activitiesPerWeek)}
          hint="Recent average"
        />
        <RoutineTile
          label="Activity routine"
          value={`${routine.routineConsistency}%`}
          hint="Days with an activity"
        />
      </div>
      <p className="mt-3 text-base leading-relaxed text-text-muted">
        {explainRoutine(routine)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {profiles.map((profile) => {
          const reading = profile.trend;
          const Icon = TREND_ICON[reading.classification];
          const reportable = isReportableTrend(reading);

          return (
            <article key={profile.domain} className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <h3 className="font-serif text-xl font-semibold">
                  {DOMAIN_LABEL[profile.domain]}
                </h3>
                {/* Icon + word: the direction never depends on colour. */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${TREND_TONE[reading.classification]}`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {trendClassLabel(reading)}
                </span>
              </div>

              {reportable && reading.previous !== null && reading.current !== null ? (
                <p className="numeric mt-4 flex items-baseline gap-2.5 font-serif text-3xl font-semibold">
                  <span className="text-text-muted">{reading.previous}</span>
                  <ArrowRight className="size-5 shrink-0 self-center" aria-hidden />
                  <span>{reading.current}</span>
                  <span className="sr-only">
                    changed from {reading.previous} to {reading.current}
                  </span>
                </p>
              ) : null}

              <p className="mt-3 text-base leading-relaxed text-text-muted">
                {explainTrend(profile)}
              </p>

              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3.5 text-sm text-text-muted">
                <div className="flex gap-1.5">
                  <dt>Activities:</dt>
                  <dd className="numeric font-semibold">
                    {profile.activityCount}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Confidence:</dt>
                  <dd className="font-semibold">
                    {confidenceLabel(profile.confidence)}
                  </dd>
                </div>
                {profile.baseline.state === "NOT_ESTABLISHED" ? (
                  <div className="flex gap-1.5">
                    <dt className="sr-only">Baseline:</dt>
                    <dd>Still establishing a starting point</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoutineTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-base font-medium text-text-muted">{label}</p>
      <p className="numeric mt-1.5 font-serif text-3xl leading-none font-semibold">
        {value}
      </p>
      <p className="mt-1.5 text-sm text-text-muted">{hint}</p>
    </div>
  );
}
