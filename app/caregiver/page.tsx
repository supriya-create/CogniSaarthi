import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CircleAlert,
  Gauge,
  Images,
  ListChecks,
} from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { SummaryTile } from "@/components/caregiver/SummaryTile";
import { RecentSessionRow } from "@/components/caregiver/RecentSessionRow";
import { CognitivePerformancePanel } from "@/components/caregiver/CognitivePerformancePanel";
import { CognitiveTrends } from "@/components/caregiver/CognitiveTrends";
import { SuggestedNext } from "@/components/caregiver/SuggestedNext";
import { PersonalisationExplainer } from "@/components/caregiver/PersonalisationExplainer";
import { Badge } from "@/components/ui/Badge";
import { CardIcon } from "@/components/ui/Card";
import { GlowDecor } from "@/components/ui/Decor";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { timeZoneForUser } from "@/lib/caregiver/access";
import { getCaregiverOverview } from "@/lib/db/queries";
import { getCognitiveProfile } from "@/lib/cognitive-performance/profile";
import { getDailyPlan, getIntelligenceSnapshot } from "@/lib/intelligence/server";
import { getDefinition } from "@/lib/game-engine/definitions";
import { getDailySummary } from "@/lib/summaries/queries";
import {
  getAlertsForCaregiver,
  syncAlerts,
} from "@/lib/caregiver/alerts";
import { DataFreshness } from "@/components/caregiver/DataFreshness";
import { SnapshotSync } from "@/components/caregiver/SnapshotSync";
import { formatDayLabel, formatTime, greetingKey } from "@/lib/utils/date";
import { getDict } from "@/lib/i18n/dictionaries";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

/** Alert severity, as a border + fill + icon colour. Always paired
    with the alert's own title text, never carried by colour alone. */
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
      <CaregiverShell action={<SignOutButton />} nav>
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
  const [cognitiveProfile, daily, openAlerts, snapshot, plan] =
    await Promise.all([
      getCognitiveProfile(user.id),
      getDailySummary(user.id, timeZone),
      getAlertsForCaregiver(caregiver.id, user.id, "all"),
      // Phase 6: the longer arc, and what is being suggested next.
      getIntelligenceSnapshot(user.id),
      getDailyPlan(user.id),
    ]);

  const dict = getDict("EN");
  const greeting = dict[greetingKey()];
  const attention = openAlerts.filter((a) => a.status !== "READ").slice(0, 3);

  const latest = sessions.find((session) => session.result !== null);
  const latestName = latest
    ? (getDefinition(latest.gameId)?.name.EN ?? latest.game.name)
    : null;

  return (
    <CaregiverShell action={<SignOutButton />} nav subject={user.name}>
      <section className="panel surface-glow relative isolate overflow-hidden p-6 sm:p-7">
        <GlowDecor className="-top-24 -right-16 size-72" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[0.12em] text-text-muted uppercase">
              {formatDayLabel(new Date(), "en-IN")}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
              {greeting}
            </h1>
            <p className="mt-2 text-lg text-text-muted">
              {user.name}
              {latest && latestName ? (
                <> — latest activity: {latestName} ({latest.result?.score}%)</>
              ) : (
                <> — no activities recorded yet.</>
              )}
            </p>
          </div>
          <Badge tone="neutral">{overview.link.relationship}</Badge>
        </div>
      </section>

      {/* How current these figures are — and a plain note if the
          connection drops while the page is open. */}
      <DataFreshness label={formatTime(new Date(), "en-IN")} />

      {/* Phase 7: keep a read-only copy on this device, so this page
          has something to fall back to without a connection. Renders
          nothing. */}
      <SnapshotSync caregiverId={caregiver.id} />

      {/* Today's overview */}
      <h2 className="mt-9 font-serif text-2xl font-semibold">
        Today&apos;s overview
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Activities"
          value={`${daily.activities.completed} / ${daily.activities.goal}`}
          hint="Completed today"
          Icon={ListChecks}
          tone="primary"
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
          tone="secondary"
        />
        <SummaryTile
          label="Average score"
          value={overview.averageScore === null ? "—" : `${overview.averageScore}%`}
          hint="Last 10 activities"
          Icon={Gauge}
          tone="accent"
        />
      </div>

      {/* Needs attention */}
      <section className="mt-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">Needs attention</h2>
          <Link
            href="/caregiver/alerts"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-base font-semibold text-primary transition-colors hover:bg-primary-soft"
          >
            All alerts
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="mt-4 flex items-center gap-3 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-base font-medium text-success">
            <CalendarCheck className="size-5 shrink-0" aria-hidden />
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {attention.map((alert) => (
              <li
                key={alert.id}
                className={`flex items-start gap-3.5 rounded-2xl border-l-4 border-y border-r px-5 py-4 shadow-soft ${SEVERITY_TONE[alert.severity]}`}
              >
                <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-text">{alert.title}</p>
                  <p className="mt-0.5 text-base text-text-muted">
                    {alert.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/caregiver/memories"
        className="panel panel-interactive group mt-9 flex items-center gap-4 p-5"
      >
        <CardIcon tone="secondary" size="sm">
          <Images className="size-6" />
        </CardIcon>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-semibold">Memory bank</span>
          <span className="text-base text-text-muted">
            Add people, places and moments for {user.name} to remember.
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-base font-semibold text-primary">
          Manage
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </Link>

      <CognitivePerformancePanel
        profiles={cognitiveProfile}
        userName={user.name}
      />

      {/* Phase 6: the longer arc, and the reasoning behind today's plan. */}
      <CognitiveTrends
        profiles={snapshot.profiles}
        routine={snapshot.routine}
        userName={user.name}
      />

      <SuggestedNext plan={plan} userName={user.name} />

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
          <div className="panel mt-4 overflow-x-auto p-0">
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

      <p className="mt-9 rounded-2xl border border-border bg-surface-alt/60 px-5 py-4 text-base leading-relaxed text-text-muted">
        These scores describe how the activities went, nothing more. They are
        not a medical measurement and should not be read as a sign of decline
        or improvement.
      </p>
    </CaregiverShell>
  );
}
