import { CalendarHeart, Check } from "lucide-react";

import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { requireUser } from "@/lib/auth/current-user";
import { getDict, localeTag } from "@/lib/i18n/dictionaries";
import { formatDayLabel } from "@/lib/utils/date";
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
  const dateLabel = formatDayLabel(new Date(), localeTag(language));

  return (
    <PageShell
      header={
        <ElderlyHeader backHref="/home" backLabel={dict.back} dict={dict} />
      }
      nav={<BottomNav dict={dict} />}
    >
      <SectionHeading
        as="h1"
        size="lg"
        eyebrow={dateLabel}
        title={dict.routineTitle}
      />

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={dict.remindersNoneToday}
            body={dict.routineEmpty}
            icon={<CalendarHeart className="size-10" aria-hidden />}
          />
        </div>
      ) : (
        <ol className="mt-8 flex flex-col">
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
                      "flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl shadow-soft",
                      done
                        ? "border-success/40 bg-success-soft"
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
                    <span
                      className={cn(
                        "my-1 w-0.5 flex-1 rounded-full",
                        done ? "bg-success/40" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>

                <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-0")}>
                  <div
                    className={cn(
                      "rounded-2xl border px-5 py-4",
                      done
                        ? "border-success/25 bg-success-soft/40"
                        : "border-border bg-surface shadow-soft",
                    )}
                  >
                    <p className="numeric text-base font-bold text-text-muted">
                      {formatTimeMinutes(item.timeMinutes)}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 font-serif text-xl leading-tight font-semibold",
                        done && "text-text-muted line-through",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="mt-1 text-base text-text-muted">
                      {reminderCategoryLabel(dict, item.category)}
                      {done ? ` · ${dict.done}` : ""}
                    </p>
                  </div>
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
