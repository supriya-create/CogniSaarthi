"use client";

import { Star } from "lucide-react";
import type { Language } from "@prisma/client";

import { SavedLocallyBadge } from "@/components/offline/OfflineStatus";
import { getDict } from "@/lib/i18n/dictionaries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { useUnsyncedSessions } from "@/lib/offline/useOffline";

/**
 * Activities played on this device that the server has not confirmed
 * yet — because there was no connection, or because the connection has
 * not come back.
 *
 * Two reasons this exists: history must never look empty just because
 * the server is out of reach, and a person who played three activities
 * on the bus should see all three. Once a session syncs it disappears
 * from here and appears in the server's own list, so nothing is ever
 * listed twice.
 */
export function UnsyncedHistory({ language }: { language: Language }) {
  const sessions = useUnsyncedSessions();
  const dict = getDict(language);

  if (sessions.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-semibold">{dict.historyToday}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {sessions.map((session) => {
          const definition = getDefinition(session.gameId);
          return (
            <li
              key={session.clientSessionId}
              className="flex items-center gap-4 panel p-4 shadow-soft"
            >
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-alt text-2xl"
              >
                {definition?.glyph ?? "🧠"}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-semibold">
                  {definition?.name[language] ?? session.gameId}
                </span>
                <SavedLocallyBadge language={language} />
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tabular-nums">
                <Star className="size-5 text-accent" aria-hidden />
                {session.stars}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
