import { Check } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/dictionaries";
import { syncReminderDay } from "@/lib/reminders/sync";
import {
  REMINDER_CATEGORY_EMOJI,
  reminderCategoryLabel,
} from "@/lib/reminders/labels";
import { formatTimeMinutes } from "@/lib/reminders/recurrence";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

/**
 * The daily routine: the caregiver builds it (as the day's reminders),
 * the elder simply follows it. A quiet timeline, not a calendar app —
 * completed steps carry a tick, and acting on a step happens on the
 * Reminders screen.
 */
export default async function RoutinePage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);
  const timeZone = user.preference?.timeZone ?? "Asia/Kolkata";

  const items = await syncReminderDay(user.id, timeZone);

  return (
    <PageShell
      header={<ElderlyHeader backHref="/home" backLabel={dict.back} />}
      nav={<BottomNav dict={dict} />}
    >
      <h1 className="font-serif text-3xl leading-tight font-semibold">
        {dict.routineTitle} 🌼
      </h1>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center text-xl text-text-muted">
          {dict.routineEmpty}
        </p>
      ) : (
        <ol className="mt-6 flex flex-col">
          {items.map((item, index) => {
            const done = item.state === "done";
            const isLast = index === items.length - 1;
            return (
              <li
                key={`${item.reminderId}|${item.scheduledFor.toISOString()}`}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-full border-2 text-2xl",
                      done
                        ? "border-success bg-success-soft"
                        : "border-border bg-surface",
                    )}
                    aria-hidden
                  >
                    {done ? (
                      <Check className="size-6 text-success" />
                    ) : (
                      REMINDER_CATEGORY_EMOJI[item.category]
                    )}
                  </span>
                  {!isLast ? (
                    <span className="w-0.5 flex-1 bg-border" aria-hidden />
                  ) : null}
                </div>

                <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                  <p className="text-lg font-semibold text-text-muted">
                    {formatTimeMinutes(item.timeMinutes)}
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold",
                      done && "text-text-muted line-through",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-base text-text-muted">
                    {reminderCategoryLabel(dict, item.category)}
                    {done ? ` · ${dict.done}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8">
        <LinkButton href="/reminders" variant="outline" fullWidth>
          {dict.remindersTodayTitle}
        </LinkButton>
      </div>
    </PageShell>
  );
}
