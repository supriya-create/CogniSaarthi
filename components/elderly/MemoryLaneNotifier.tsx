"use client";

import { useEffect, useRef } from "react";
import type { Language } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";
import { notificationReadiness, notify } from "@/lib/notifications/browser";
import { canShowNotifications } from "@/lib/notifications/capability";
import { connectivity } from "@/lib/offline/connectivity";
import * as repo from "@/lib/offline/repositories";
import {
  deriveState,
  isDue,
  type RetrievalEvent,
} from "@/lib/memories/retrieval";

/**
 * Shows one notification when memories come due in Memory Lane.
 *
 * A sibling of `ReminderNotifier` and built the same way, deliberately:
 * it reads the LOCAL replica rather than the network, so it works on
 * the patchy connection this product is built for, and it reuses the
 * same pure scheduler the screens use so a notification can never
 * disagree with what Memory Lane would actually show.
 *
 * It renders nothing.
 *
 * ## What the notification says
 *
 * "Your Cognisaarthi activity is ready." Nothing else — no name, no
 * relationship, no photograph, no count. A notification appears on a
 * LOCK SCREEN, which on a shared family tablet is readable by anyone
 * in the room, and `buildSafeNotification` has no parameter through
 * which memory content could be passed even if somebody tried.
 *
 * ## What it honestly cannot do
 *
 * It is a page-driven timer, so it fires while Cognisaarthi is open or
 * in a background tab. It cannot wake a closed browser — that needs
 * Web Push, which this product does not have. The profile screen says
 * so beside the switch rather than leaving somebody to find out by
 * missing something.
 */

/**
 * Checked every five minutes rather than every minute like reminders.
 *
 * A reminder has a time somebody agreed to and being ten minutes late
 * matters. A memory coming due is not an appointment: the schedule
 * spans days, and the difference between hearing about it now and in
 * five minutes is nothing at all. The longer tick is a real saving on
 * a tablet's battery for no cost to the person.
 */
const TICK_MS = 5 * 60_000;

/**
 * How long to wait after the last notification before sending another.
 *
 * Six hours. Memory Lane's own schedule will make something due again
 * within twenty seconds of a missed prompt, and without this floor a
 * quiet afternoon would produce a banner every five minutes. One
 * gentle nudge a day is the intent; this is the mechanism.
 */
const QUIET_MS = 6 * 60 * 60 * 1000;

export function MemoryLaneNotifier({
  userId,
  language,
}: {
  userId: string | null;
  language: Language;
}) {
  // When we last notified, in this page session. A ref, not state:
  // nothing renders from it, and re-rendering every tick is waste.
  const lastNotifiedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function tick() {
      // Re-checked every tick rather than cached: permission can be
      // revoked from browser settings while the app is open, and a
      // revoked permission must stop us rather than throw.
      if (!canShowNotifications(notificationReadiness())) return;

      const now = Date.now();
      if (
        lastNotifiedAt.current !== null &&
        now - lastNotifiedAt.current < QUIET_MS
      ) {
        return;
      }

      const due = await countDueMemories(new Date(now));
      if (cancelled || due === 0) return;

      // Mark BEFORE showing. If the show fails we still do not retry
      // on the next tick — one missed banner is a far smaller harm
      // than a notification loop.
      lastNotifiedAt.current = now;

      // ONE notification however many memories are due. The payload
      // carries no content, so three banners would convey nothing a
      // single one does not while being three times as alarming.
      await notify("MEMORY_LANE_DUE", getDict(language));
    }

    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);

    // Also check whenever a sync run finishes.
    //
    // Without this, the very first tick on a device that has just been
    // set up finds an empty local replica — the snapshot has not
    // arrived yet — concludes nothing is due, and then says nothing
    // for five minutes. The connectivity store changes state around
    // every sync, which is exactly when the replica has just been
    // refreshed and the answer may have changed.
    const unsubscribe = connectivity.subscribe(() => void tick());

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [userId, language]);

  return null;
}

/**
 * How many memories are ready, from this device's own replica.
 *
 * Uses `deriveState` and `isDue` — the same pure functions Memory Lane
 * itself builds a sitting from — so a notification cannot promise
 * something the screen will not then offer.
 */
async function countDueMemories(now: Date): Promise<number> {
  const [memories, events] = await Promise.all([
    repo.getMemories(),
    repo.allMemoryRecalls(),
  ]);
  if (memories.length === 0) return 0;

  const byMemory = new Map<string, RetrievalEvent[]>();
  for (const event of events) {
    const entry: RetrievalEvent = {
      outcome: event.outcome,
      occurredAt: new Date(event.occurredAt),
    };
    const list = byMemory.get(event.memoryId);
    if (list) list.push(entry);
    else byMemory.set(event.memoryId, [entry]);
  }

  let due = 0;
  for (const memory of memories) {
    if (isDue(deriveState(byMemory.get(memory.id) ?? [], now), now)) due += 1;
  }
  return due;
}
