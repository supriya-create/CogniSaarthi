import { Bell, Brain, CircleCheck, Heart, Mic, Play } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { ProgressDots } from "@/components/elderly/ProgressDots";
import { QuickAction } from "@/components/elderly/QuickAction";
import { requireUser } from "@/lib/auth/current-user";
import {
  DAILY_GOAL,
  getGameIdsCompletedToday,
  getTodaysCompletedCount,
} from "@/lib/db/queries";
import { getDict } from "@/lib/i18n/dictionaries";
import { GAME_DEFINITIONS } from "@/lib/game-engine/definitions";
import { greetingKey } from "@/lib/utils/date";

export default async function HomePage() {
  const user = await requireUser();
  const dict = getDict(user.preference?.language ?? user.language);

  const [completedToday, playedToday] = await Promise.all([
    getTodaysCompletedCount(user.id),
    getGameIdsCompletedToday(user.id),
  ]);

  // "Today's activity" is the first activity not yet finished today.
  // A plain rule, applied the same way every day — not a suggestion
  // dressed up as a recommendation.
  const nextGame =
    GAME_DEFINITIONS.find((game) => !playedToday.has(game.id)) ??
    GAME_DEFINITIONS[0];

  const hasStarted = completedToday > 0;
  const goalMet = completedToday >= DAILY_GOAL;

  const primaryLabel = goalMet
    ? dict.playAnother
    : hasStarted
      ? dict.continueActivity
      : dict.startTodaysActivity;

  return (
    <PageShell header={<ElderlyHeader />} nav={<BottomNav dict={dict} />}>
      <section className="animate-fade-up">
        <h1 className="font-serif text-4xl leading-tight font-semibold">
          {dict[greetingKey()]}, {user.name}
        </h1>
        <p className="mt-3 text-xl text-text-muted">{dict.homeInvite}</p>
      </section>

      <section className="mt-8">
        <LinkButton
          href={`/games/${nextGame.id}`}
          fullWidth
          icon={<Play className="size-7 shrink-0" aria-hidden />}
          className="py-6 text-2xl"
        >
          {primaryLabel}
        </LinkButton>
      </section>

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

        {/* Finishing the day is worth saying out loud, not just
            filling in a third dot. */}
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
