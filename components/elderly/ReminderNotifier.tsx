"use client";

import { useEffect, useRef } from "react";
import type { Language } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";
import { notificationReadiness, notify } from "@/lib/notifications/browser";
import { canShowNotifications } from "@/lib/notifications/capability";
import {
  notificationKey,
  occurrencesToNotify,
  type NotifiableOccurrence,
} from "@/lib/notifications/schedule";
import * as repo from "@/lib/offline/repositories";
import { occurrencesBetween } from "@/lib/reminders/recurrence";
import { classifyOccurrence } from "@/lib/reminders/status";
import { addDays, localDayOf, zonedTimeToUtc } from "@/lib/reminders/timezone";

/**
 * Watches the day and shows a notification when a reminder comes due.
 *
 * Reads from the LOCAL replica, not the network, which is what makes
 * this work on the patchy connection the product is built for: the
 * reminder definitions and their answers are already in IndexedDB, and
 * the occurrence maths is the same pure code the server uses.
 *
 * It renders nothing. Mounted once at the root beside OfflineProvider.
 *
 * Honest about its limits: this is a page-driven timer, so it fires
 * while Cognisaarthi is open or in a background tab. It cannot wake a
 * closed browser — that needs Web Push, which this product does not
 * have, and the profile screen says so next to the switch rather than
 * leaving somebody to find out by missing something.
 */
const TICK_MS = 60_000;

export function ReminderNotifier({
  userId,
  language,
}: {
  userId: string | null;
  language: Language;
}) {
  // Occurrences already notified in this page session. A ref, not
  // state: nothing renders from it, and re-rendering on every tick
  // would be pure waste.
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function tick() {
      // Re-checked every tick rather than cached: permission can be
      // revoked from browser settings while the app is open, and a
      // revoked permission must stop us, not throw.
      if (!canShowNotifications(notificationReadiness())) return;

      const occurrences = await todaysOccurrences();
      if (cancelled) return;

      const now = new Date();
      const due = occurrencesToNotify(occurrences, now, notified.current);
      if (due.length === 0) return;

      // Mark BEFORE showing. If the show fails we still do not retry on
      // the next tick sixty seconds later — one missed banner is a far
      // smaller harm than a notification loop.
      for (const occurrence of due) {
        notified.current.add(notificationKey(occurrence));
      }

      // One banner however many came due — the text carries no content,
      // so repeating it would add alarm without adding information.
      await notify("REMINDER_DUE", getDict(language));
    }

    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, language]);

  return null;
}

/**
 * Rebuild today's occurrences from the local replica.
 *
 * Uses `occurrencesBetween` and `classifyOccurrence` — the same pure
 * functions behind the reminders screen and the server's own day sync,
 * so a notification can never disagree with what the screen shows.
 */
async function todaysOccurrences(): Promise<NotifiableOccurrence[]> {
  const [profile, reminders, logs] = await Promise.all([
    repo.getProfile(),
    repo.getReminders(),
    repo.allReminderLogs(),
  ]);

  const timeZone = profile?.timeZone ?? "Asia/Kolkata";
  const now = new Date();

  const today = localDayOf(now, timeZone);
  const dayStart = zonedTimeToUtc(today, 0, timeZone);
  const dayEnd = zonedTimeToUtc(addDays(today, 1), 0, timeZone);

  const logByKey = new Map(logs.map((log) => [log.key, log]));

  const occurrences: NotifiableOccurrence[] = [];

  for (const reminder of reminders) {
    if (!reminder.enabled) continue;

    const instants = occurrencesBetween(
      {
        recurrence: reminder.recurrence,
        timeMinutes: reminder.timeMinutes,
        weekdays: reminder.weekdays,
        monthDay: reminder.monthDay,
        startDate: new Date(reminder.startDate),
        endDate: reminder.endDate ? new Date(reminder.endDate) : null,
      },
      dayStart,
      dayEnd,
      timeZone,
    );

    for (const scheduledFor of instants) {
      const log = logByKey.get(
        `${reminder.id}|${scheduledFor.toISOString()}`,
      );
      occurrences.push({
        reminderId: reminder.id,
        scheduledFor,
        state: classifyOccurrence(
          {
            scheduledFor,
            status: log?.status ?? null,
            snoozedUntil: log?.snoozedUntil
              ? new Date(log.snoozedUntil)
              : null,
          },
          now,
        ),
      });
    }
  }

  return occurrences;
}
