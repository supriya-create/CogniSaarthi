import {
  Bell,
  CalendarHeart,
  Heart,
  LifeBuoy,
  ListChecks,
  Shapes,
  Sprout,
} from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { HomeHero } from "@/components/elderly/HomeHero";
import { QuickAction } from "@/components/elderly/QuickAction";
import { TodaysJourney } from "@/components/elderly/TodaysJourney";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { requireUser } from "@/lib/auth/current-user";
import {
  DAILY_GOAL,
  getGameIdsCompletedToday,
  getTodaysCompletedCount,
} from "@/lib/db/queries";
import { getDailyPlan, getIntelligenceSnapshot } from "@/lib/intelligence/server";
import { getLaneSummary } from "@/lib/memories/server";
import { elderProgressKey } from "@/lib/intelligence/explanations";
import { getDict, localeTag } from "@/lib/i18n/dictionaries";
import { formatDayLabel, greetingKey } from "@/lib/utils/date";

export default async function HomePage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  // Phase 6: the plan now comes from the longitudinal intelligence
  // layer, which balances practice need against variety and recent
  // success — and quietly shortens the day when activities have been
  // hard work, or when someone is coming back after a gap. Difficulty
  // is still decided by the Phase 2 engine when each activity opens.
  const [completedToday, playedToday, plan, snapshot, lane] = await Promise.all([
    getTodaysCompletedCount(user.id),
    getGameIdsCompletedToday(user.id),
    getDailyPlan(user.id),
    getIntelligenceSnapshot(user.id),
    // Counts only. The home screen has no business carrying somebody's
    // family photographs and names in its payload to decide whether to
    // show one line of text.
    getLaneSummary(user.id),
  ]);

  const goalMet = completedToday >= DAILY_GOAL;

  // One warm, non-medical line about their routine. Never a score.
  const progressKey = elderProgressKey(snapshot.routine);
  const progressLine = dict[progressKey].replace(
    "{count}",
    String(snapshot.routine.totalActivities),
  );

  const voice = user.preference?.voiceEnabled
    ? { language, speechRate: user.preference.speechRate }
    : undefined;

  return (
    <PageShell
      header={<ElderlyHeader dict={dict} />}
      hero={
        <HomeHero
          greeting={dict[greetingKey()]}
          name={user.name}
          invite={dict.homeInvite}
          dateLabel={formatDayLabel(new Date(), localeTag(language))}
          completed={completedToday}
          goal={DAILY_GOAL}
          goalMet={goalMet}
          goalMetLine={dict.homeGoalMet}
          progressLine={progressLine}
          progressLabel={dict.todaysProgress}
          ofLabel={dict.ofTotal}
        />
      }
      nav={<BottomNav dict={dict} voice={voice} />}
    >
      <div className="animate-fade-up">
        <TodaysJourney
          plan={plan}
          completedGameIds={playedToday}
          language={language}
          dict={dict}
          memoryLane={{ total: lane.total, dueCount: lane.dueCount }}
        />
      </div>

      <section className="mt-10">
        <SectionHeading title={dict.quickActions} size="md" />

        <div className="stagger mt-5 grid gap-3.5 sm:grid-cols-2">
          <QuickAction
            href="/games"
            label={dict.navGames}
            description={dict.gamesSubtitle}
            Icon={Shapes}
            tone="primary"
          />
          <QuickAction
            href="/memories"
            label={dict.navMemories}
            description={dict.memoriesBody}
            Icon={Heart}
            tone="secondary"
          />
          <QuickAction
            href="/memories/lane"
            label={dict.laneTitle}
            description={dict.laneSubtitle}
            Icon={Sprout}
            tone="sage"
          />
          <QuickAction
            href="/reminders"
            label={dict.navReminders}
            description={dict.homeTileReminders}
            Icon={Bell}
            tone="tea"
          />
          <QuickAction
            href="/routine"
            label={dict.navRoutine}
            description={dict.homeTileRoutine}
            Icon={CalendarHeart}
            tone="sage"
          />
          <QuickAction
            href="/history"
            label={dict.navHistory}
            description={dict.historySubtitle}
            Icon={ListChecks}
            tone="sage"
          />
          <QuickAction
            href="/help"
            label={dict.sosTitle}
            description={dict.homeTileHelp}
            Icon={LifeBuoy}
            tone="primary"
          />
        </div>
      </section>
    </PageShell>
  );
}
