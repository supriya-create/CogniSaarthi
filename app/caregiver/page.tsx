import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CircleAlert,
  Gauge,
  Images,
  ListChecks,
} from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverNav } from "@/components/caregiver/CaregiverNav";
import { SummaryTile } from "@/components/caregiver/SummaryTile";
import { RecentSessionRow } from "@/components/caregiver/RecentSessionRow";
import { CognitivePerformancePanel } from "@/components/caregiver/CognitivePerformancePanel";
import { PersonalisationExplainer } from "@/components/caregiver/PersonalisationExplainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { timeZoneForUser } from "@/lib/caregiver/access";
import { getCaregiverOverview } from "@/lib/db/queries";
import { getCognitiveProfile } from "@/lib/cognitive-performance/profile";
import { getDefinition } from "@/lib/game-engine/definitions";
import { getDailySummary } from "@/lib/summaries/queries";
import {
  getAlertsForCaregiver,
  syncAlerts,
} from "@/lib/caregiver/alerts";
import { greetingKey } from "@/lib/utils/date";
import { getDict } from "@/lib/i18n/dictionaries";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

const SEVERITY_TONE = {
  IMPORTANT: "border-warning/40 bg-warning-soft text-warning",
  ATTENTION: "border-secondary/30 bg-secondary-soft text-secondary",
  INFO: "border-success/30 bg-success-soft text-success",
};

export default async function CaregiverDashboard() {
  const caregiver = await requireCaregiver();
  const overview = await getCaregiverOverview(caregiver.id);

  if (!overview) {
    return (
      <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
        <EmptyState
          title="No one is connected to your account yet."
          body="Ask your family member to open their profile in Cognisaarthi and read out the connection code, then sign up again with it."
        />
      </CaregiverShell>
    );
  }

  const { user, sessions } = overview;
  const timeZone = await timeZoneForUser(user.id);

  // Lazy sync (no cron), then read the picture for the dashboard.
  await syncAlerts(user.id, timeZone);
  const [cognitiveProfile, daily, openAlerts] = await Promise.all([
    getCognitiveProfile(user.id),
    getDailySummary(user.id, timeZone),
    getAlertsForCaregiver(caregiver.id, user.id, "all"),
  ]);

  const dict = getDict("EN");
  const greeting = dict[greetingKey()];
  const attention = openAlerts.filter((a) => a.status !== "READ").slice(0, 3);

  const latest = sessions.find((session) => session.result !== null);
  const latestName = latest
    ? (getDefinition(latest.gameId)?.name.EN ?? latest.game.name)
    : null;

  return (
    <CaregiverShell action={<SignOutButton />} nav={<CaregiverNav />}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{greeting}</h1>
          <p className="mt-1.5 text-lg text-text-muted">
            {user.name}
            {latest && latestName ? (
              <> — latest activity: {latestName} ({latest.result?.score}%)</>
            ) : (
              <> — no activities recorded yet.</>
            )}
          </p>
        </div>
        <p className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-text-muted">
          {overview.link.relationship}
        </p>
      </div>

      {/* Today's overview */}
      <h2 className="mt-7 font-serif text-xl font-semibold">Today&apos;s overview</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Activities"
          value={`${daily.activities.completed} / ${daily.activities.goal}`}
          hint="Completed today"
          Icon={ListChecks}
        />
        <SummaryTile
          label="Reminders"
          value={
            daily.reminders.total === 0
              ? "None due"
              : `${daily.reminders.acknowledged} / ${daily.reminders.total}`
          }
          hint="Acknowledged today"
          Icon={Bell}
        />
        <SummaryTile
          label="Average score"
          value={overview.averageScore === null ? "—" : `${overview.averageScore}%`}
          hint="Last 10 activities"
          Icon={Gauge}
        />
      </div>

      {/* Needs attention */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Needs attention</h2>
          <Link
            href="/caregiver/alerts"
            className="text-sm font-semibold text-primary hover:underline"
          >
            All alerts →
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-base font-medium text-success">
            <CalendarCheck className="size-5 shrink-0" aria-hidden />
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {attention.map((alert) => (
              <li
                key={alert.id}
                className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${SEVERITY_TONE[alert.severity]}`}
              >
                <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold text-text">{alert.title}</p>
                  <p className="text-sm text-text-muted">{alert.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/caregiver/memories"
        className="mt-8 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-colors hover:border-border-strong hover:bg-surface-alt"
      >
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary-soft text-secondary"
        >
          <Images className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-semibold">Memory bank</span>
          <span className="text-base text-text-muted">
            Add people, places and moments for {user.name} to remember.
          </span>
        </span>
        <span className="shrink-0 text-base font-semibold text-primary">
          Manage →
        </span>
      </Link>

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
                  <th scope="col" className="px-5 py-3">Activity</th>
                  <th scope="col" className="px-0 py-3">Level</th>
                  <th scope="col" className="py-3 pr-4 text-right">Score</th>
                  <th scope="col" className="py-3 pr-4 text-right">Time</th>
                  <th scope="col" className="py-3 pr-4">When</th>
                  <th scope="col" className="py-3 pr-5">Status</th>
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

      <p className="mt-8 max-w-2xl text-base leading-relaxed text-text-muted">
        These scores describe how the activities went, nothing more. They are
        not a medical measurement and should not be read as a sign of decline
        or improvement.
      </p>
    </CaregiverShell>
  );
}
