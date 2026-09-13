import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { CognitiveDomain } from "@prisma/client";

import type { DomainProfile } from "@/lib/cognitive-performance/profile";
import {
  explainRecommendation,
  summariseDomain,
  trendLabel,
} from "@/lib/cognitive-performance/recommendations";
import type { Trend } from "@/lib/cognitive-performance/types";

/**
 * The caregiver's view of how each cognitive area is going.
 *
 * Every word here is deliberately non-clinical: "Activity performance",
 * "Needs more practice", never a diagnosis, a probability, or a
 * medical interpretation. The numbers describe how the activities
 * went and nothing more — the page states that boundary explicitly.
 */

const DOMAIN_NAME: Record<CognitiveDomain, string> = {
  SHORT_TERM_MEMORY: "Memory",
  ATTENTION: "Attention",
  WORKING_MEMORY: "Working memory",
  LANGUAGE: "Language",
  PROCESSING_SPEED: "Processing speed",
  EXECUTIVE_FUNCTION: "Planning",
};

const CONFIDENCE_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

function TrendBadge({ trend }: { trend: Trend }) {
  const config = {
    improving: {
      Icon: TrendingUp,
      className: "text-success",
    },
    stable: {
      Icon: Minus,
      className: "text-text-muted",
    },
    declining: {
      Icon: TrendingDown,
      className: "text-warning",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon className="size-4" aria-hidden />
      {trendLabel(trend)}
    </span>
  );
}

/** A minimal trend line. Decorative — the label carries the meaning. */
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const width = 96;
  const height = 28;
  const max = 100;
  const step = width / (scores.length - 1);
  const points = scores
    .map((s, i) => `${i * step},${height - (s / max) * height}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-24"
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-secondary)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CognitivePerformancePanel({
  profiles,
  userName,
}: {
  profiles: DomainProfile[];
  userName: string;
}) {
  return (
    <section className="mt-9">
      <h2 className="font-serif text-2xl font-semibold">Activity performance</h2>
      <p className="mt-1.5 text-base text-text-muted">
        How {userName}&apos;s recent activities have been going, by area.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => {
          const { performance, recommendation } = profile;
          const name = DOMAIN_NAME[performance.domain];

          return (
            <div
              key={performance.domain}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-xl font-semibold">{name}</h3>
                {performance.coldStart ? null : (
                  <TrendBadge trend={performance.trend} />
                )}
              </div>

              {performance.coldStart ? (
                <p className="mt-3 text-base text-text-muted">
                  {summariseDomain(performance)}
                </p>
              ) : (
                <>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="font-serif text-4xl font-semibold tabular-nums">
                      {performance.indicator}
                      <span className="text-xl text-text-muted">%</span>
                    </p>
                    <Sparkline scores={profile.recentScores} />
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {summariseDomain(performance)}
                  </p>
                </>
              )}

              {/* Why the next activity is set the way it is. */}
              <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-text-muted">
                {explainRecommendation(recommendation)}
              </p>

              <p className="mt-3 text-xs font-medium tracking-wide text-text-muted uppercase">
                Personalisation: {CONFIDENCE_LABEL[performance.confidence]}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
