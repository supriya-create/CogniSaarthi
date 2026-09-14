import {
  ArrowRight,
  MoveDownRight,
  MoveUpRight,
} from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverNav } from "@/components/caregiver/CaregiverNav";
import { SummaryTile } from "@/components/caregiver/SummaryTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { getDailySummary, getWeeklySummary } from "@/lib/summaries/queries";
import type { Trend } from "@/lib/cognitive-performance/types";
import { CalendarCheck, ListChecks, Bell, Repeat } from "lucide-react";
import { SignOutButton } from "../SignOutButton";

export const dynamic = "force-dynamic";

const MEMORY_LABEL = {
  notYet: "Not yet today",
  some: "Some participation",
  good: "Good participation",
};

/**
 * Direction shown must agree with the "previous → current" figures next
 * to it. When both are known, derive it from their delta; otherwise fall
 * back to the score-slope trend from the engine.
 */
function directionFor(
  previous: number | null,
  current: number | null,
  trend: Trend,
): Trend {
  if (previous === null || current === null) return trend;
  const delta = current - previous;
  if (delta >= 3) return "improving";
  if (delta <= -3) return "declining";
  return "stable";
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <MoveUpRight className="size-4" aria-hidden /> Improving
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <MoveDownRight className="size-4" aria-hidden /> More practice
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-text-muted">
      <ArrowRight className="size-4" aria-hidden /> Stable
    </span>
  );
}

export default async function CaregiverSummaryPage() {
  const caregiver = await requireCaregiver();
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
        <EmptyState
          title="No one is connected to your account yet."
          body="Once connected, a daily and weekly summary will appear here."
        />
      </CaregiverShell>
    );
  }

  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";
  const [daily, weekly] = await Promise.all([
    getDailySummary(user.id, timeZone),
    getWeeklySummary(user.id, timeZone),
  ]);

  return (
    <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
      {/* ---------------- Daily ---------------- */}
      <h1 className="font-serif text-3xl font-semibold">Today&apos;s summary</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Activities"
          value={`${daily.activities.completed} / ${daily.activities.goal}`}
          hint="Completed today"
          Icon={ListChecks}
        />
        <SummaryTile
          label="Memory"
          value={MEMORY_LABEL[daily.memory]}
          hint="Participation"
          Icon={CalendarCheck}
        />
        <SummaryTile
          label="Attention"
          value={daily.attention === "done" ? "Completed" : "Not yet today"}
          hint="Participation"
          Icon={CalendarCheck}
        />
        <SummaryTile
          label="Reminders"
          value={
            daily.reminders.total === 0
              ? "None due"
              : `${daily.reminders.acknowledged} / ${daily.reminders.total}`
          }
          hint="Acknowledged"
          Icon={Bell}
        />
      </div>

      {/* ---------------- Weekly ---------------- */}
      <div className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">
          Cognisaarthi weekly summary
        </h2>
        <p className="mt-1 text-base text-text-muted">
          The last seven days for {user.name}. This is a wellbeing overview,
          not a medical report.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Sessions"
          value={String(weekly.weekSessionCount)}
          hint="This week"
          Icon={ListChecks}
        />
        <SummaryTile
          label="Consistency"
          value={`${weekly.completionConsistency}%`}
          hint={`${weekly.activeDays} of 7 days active`}
          Icon={CalendarCheck}
        />
        <SummaryTile
          label="Reminders"
          value={
            weekly.reminderCompletionRate === null
              ? "—"
              : `${weekly.reminderCompletionRate}%`
          }
          hint="Acknowledged this week"
          Icon={Bell}
        />
        <SummaryTile
          label="Most used"
          value={weekly.mostUsedActivity ?? "—"}
          hint="Favourite activity"
          Icon={Repeat}
        />
      </div>

      <section className="mt-8">
        <h3 className="font-serif text-xl font-semibold">Cognitive trends</h3>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full text-left text-base">
            <caption className="sr-only">
              Weekly cognitive indicator trend by area
            </caption>
            <thead>
              <tr className="text-sm font-semibold tracking-wide text-text-muted uppercase">
                <th scope="col" className="px-5 py-3">Area</th>
                <th scope="col" className="py-3">Last week → now</th>
                <th scope="col" className="py-3 pr-5">Direction</th>
              </tr>
            </thead>
            <tbody>
              {weekly.domainTrends.map((d) => (
                <tr key={d.domain} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{d.label}</td>
                  <td className="py-3">
                    {d.previous === null || d.current === null ? (
                      <span className="text-text-muted">
                        Building up a picture
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {d.previous} → {d.current}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-5">
                    <TrendBadge
                      trend={directionFor(d.previous, d.current, d.trend)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-text-muted">
        These figures describe how activities and reminders went. They are not
        a medical measurement and should not be read as a sign of decline or
        improvement in health.
      </p>
    </CaregiverShell>
  );
}
