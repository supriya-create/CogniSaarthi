import { CalendarCheck, Gauge, ListChecks } from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { SummaryTile } from "@/components/caregiver/SummaryTile";
import { RecentSessionRow } from "@/components/caregiver/RecentSessionRow";
import { CognitivePerformancePanel } from "@/components/caregiver/CognitivePerformancePanel";
import { PersonalisationExplainer } from "@/components/caregiver/PersonalisationExplainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { getCaregiverOverview, DAILY_GOAL } from "@/lib/db/queries";
import { getCognitiveProfile } from "@/lib/cognitive-performance/profile";
import { getDefinition } from "@/lib/game-engine/definitions";
import { SignOutButton } from "./SignOutButton";

export default async function CaregiverDashboard() {
  const caregiver = await requireCaregiver();
  const overview = await getCaregiverOverview(caregiver.id);

  if (!overview) {
    return (
      <CaregiverShell action={<SignOutButton />}>
        <EmptyState
          title="No one is connected to your account yet."
          body="Ask your family member to open their profile in Cognisaarthi and read out the connection code, then sign up again with it."
        />
      </CaregiverShell>
    );
  }

  const { user, sessions, completedToday, totalCompleted, averageScore } =
    overview;

  // Phase 2: per-domain performance, trends and the reason behind
  // each difficulty choice.
  const cognitiveProfile = await getCognitiveProfile(user.id);

  const latest = sessions.find((session) => session.result !== null);
  const latestName = latest
    ? (getDefinition(latest.gameId)?.name.EN ?? latest.game.name)
    : null;

  return (
    <CaregiverShell action={<SignOutButton />}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {user.name}&apos;s activity
          </h1>
          <p className="mt-1.5 text-lg text-text-muted">
            {latest && latestName ? (
              <>
                Latest activity: {latestName} — {latest.result?.score}%
              </>
            ) : (
              <>No activities recorded yet.</>
            )}
          </p>
        </div>
        <p className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-text-muted">
          {overview.link.relationship}
        </p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Games completed"
          value={String(totalCompleted)}
          hint="All time"
          Icon={ListChecks}
        />
        <SummaryTile
          label="Completed today"
          value={`${completedToday} / ${DAILY_GOAL}`}
          hint="Daily goal"
          Icon={CalendarCheck}
        />
        <SummaryTile
          label="Average score"
          value={averageScore === null ? "—" : `${averageScore}%`}
          hint="Last 10 activities"
          Icon={Gauge}
        />
      </div>

      <CognitivePerformancePanel
        profiles={cognitiveProfile}
        userName={user.name}
      />

      <section className="mt-9">
        <h2 className="font-serif text-2xl font-semibold">Recent activities</h2>

        {sessions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing to show yet."
              body={`${user.name} has not started an activity. Scores will appear here as soon as they do.`}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
            <table className="w-full min-w-[42rem] text-left text-base">
              <caption className="sr-only">
                Recent activities completed by {user.name}
              </caption>
              <thead>
                <tr className="text-sm font-semibold tracking-wide text-text-muted uppercase">
                  <th scope="col" className="px-5 py-3">
                    Activity
                  </th>
                  <th scope="col" className="px-0 py-3">
                    Level
                  </th>
                  <th scope="col" className="py-3 pr-4 text-right">
                    Score
                  </th>
                  <th scope="col" className="py-3 pr-4 text-right">
                    Time
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    When
                  </th>
                  <th scope="col" className="py-3 pr-5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
                {sessions.map((session) => (
                  <RecentSessionRow key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PersonalisationExplainer />

      {/* An explicit boundary on what this data is and is not. */}
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-text-muted">
        These scores describe how the activities went, nothing more. They are
        not a medical measurement and should not be read as a sign of decline
        or improvement.
      </p>
    </CaregiverShell>
  );
}
