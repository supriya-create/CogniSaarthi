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
      className: "border-success/25 bg-success-soft text-success",
    },
    stable: {
      Icon: Minus,
      className: "border-border bg-surface-alt text-text-muted",
    },
    declining: {
      Icon: TrendingDown,
      className: "border-warning/30 bg-warning-soft text-warning",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon className="size-4" aria-hidden />
      {trendLabel(trend)}
    </span>
  );
}

/**
 * A minimal trend line with a soft fill beneath it. Decorative — the
 * label and the number carry the meaning, and the line is never the
 * only place a direction is stated.
 */
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const width = 104;
  const height = 32;
  const max = 100;
  const step = width / (scores.length - 1);
  const coords = scores.map(
    (s, i) => `${i * step},${height - (s / max) * height}`,
  );
  const line = coords.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-26"
      aria-hidden
      preserveAspectRatio="none"
    >
      <polygon points={area} fill="var(--c-primary)" opacity="0.12" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--c-primary)"
        strokeWidth={2.5}
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
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold">Activity performance</h2>
      <p className="mt-2 text-base leading-relaxed text-text-muted">
        How {userName}&apos;s recent activities have been going, by area.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => {
          const { performance, recommendation } = profile;
          const name = DOMAIN_NAME[performance.domain];

          return (
            <div
              key={performance.domain}
              className="panel flex flex-col p-5"
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
                    <p className="numeric font-serif text-4xl leading-none font-semibold">
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

              <p className="mt-3 text-xs font-semibold tracking-[0.1em] text-text-muted uppercase">
                Personalisation: {CONFIDENCE_LABEL[performance.confidence]}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
