import { Bell, Brain, CircleCheck, Heart, Mic } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { ProgressDots } from "@/components/elderly/ProgressDots";
import { QuickAction } from "@/components/elderly/QuickAction";
import { TodaysJourney } from "@/components/elderly/TodaysJourney";
import { requireUser } from "@/lib/auth/current-user";
import {
  DAILY_GOAL,
  getGameIdsCompletedToday,
  getTodaysCompletedCount,
} from "@/lib/db/queries";
import { getDailyJourney } from "@/lib/cognitive-performance/profile";
import { getDict } from "@/lib/i18n/dictionaries";
import { greetingKey } from "@/lib/utils/date";

export default async function HomePage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  // Phase 2: the home screen leads with a personalised plan built
  // from the person's history. The journey orders activities weakest
  // area first; each opens at a level the engine chose for them.
  const [completedToday, playedToday, journey] = await Promise.all([
    getTodaysCompletedCount(user.id),
    getGameIdsCompletedToday(user.id),
    getDailyJourney(user.id),
  ]);

  const goalMet = completedToday >= DAILY_GOAL;

  return (
    <PageShell header={<ElderlyHeader />} nav={<BottomNav dict={dict} />}>
      <section className="animate-fade-up">
        <h1 className="font-serif text-4xl leading-tight font-semibold">
          {dict[greetingKey()]}, {user.name}
        </h1>
        <p className="mt-3 text-xl text-text-muted">{dict.homeInvite}</p>
      </section>

      <div className="mt-8">
        <TodaysJourney
          journey={journey}
          completedGameIds={playedToday}
          language={language}
          dict={dict}
        />
      </div>

      <section
        className={`mt-8 rounded-2xl border p-5 shadow-soft ${
          goalMet
            ? "border-success/30 bg-success-soft"
            : "border-border bg-surface"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-semibold">
            {dict.todaysProgress}
          </h2>
          <ProgressDots
            total={DAILY_GOAL}
            filled={Math.min(completedToday, DAILY_GOAL)}
            label={dict.todaysProgress}
            ofLabel={dict.ofTotal}
          />
        </div>

        {goalMet ? (
          <p className="mt-2 flex items-start gap-2 text-lg font-medium text-success">
            <CircleCheck className="mt-1 size-5 shrink-0" aria-hidden />
            {dict.homeGoalMet}
          </p>
        ) : (
          <p className="mt-2 text-lg text-text-muted">
            {Math.min(completedToday, DAILY_GOAL)} / {DAILY_GOAL}{" "}
            {dict.progressOf}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">
          {dict.quickActions}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuickAction
            href="/games"
            label={dict.navGames}
            Icon={Brain}
            tone="primary"
          />
          <QuickAction
            href="/memories"
            label={dict.navMemories}
            Icon={Heart}
            tone="secondary"
          />
          <QuickAction
            href="/reminders"
            label={dict.navReminders}
            Icon={Bell}
            tone="tea"
          />
          {/* Voice is not built. It is shown, plainly switched off,
              rather than hidden or faked. */}
          <QuickAction
            href="#"
            label={dict.navTalk}
            Icon={Mic}
            comingSoon
            comingSoonLabel={dict.comingSoon}
          />
        </div>
      </section>
    </PageShell>
  );
}
