import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import type { Language } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import { difficultyLabel } from "@/lib/i18n/labels";
import type { SessionWithResult } from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { formatTime } from "@/lib/utils/date";
import { localeTag } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

/**
 * One line in the activity history.
 *
 * A finished activity links to its result; an unfinished one does
 * not pretend to have a score. Status is shown with an icon and a
 * word, never as a colour alone.
 */
export function ActivityItem({
  session,
  language,
  dict,
}: {
  session: SessionWithResult;
  language: Language;
  dict: Dict;
}) {
  const definition = getDefinition(session.gameId);
  const name = definition?.name[language] ?? session.game.name;
  const completed = session.status === "COMPLETED" && session.result !== null;

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-alt text-2xl"
      >
        {definition?.glyph ?? "🧠"}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-semibold leading-tight">{name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-base text-text-muted">
          <span>{difficultyLabel(session.difficulty, dict)}</span>
          <span aria-hidden>·</span>
          <span>{formatTime(session.startedAt, localeTag(language))}</span>
        </span>
      </span>

      {completed && session.result ? (
        <span className="flex shrink-0 flex-col items-end">
          <span className="numeric font-serif text-2xl leading-none font-semibold">
            {session.result.score}%
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
            <CircleCheck className="size-4" aria-hidden />
            {dict.historyCompleted}
          </span>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-text-muted">
          <CircleDashed className="size-4" aria-hidden />
          {dict.historyUnfinished}
        </span>
      )}
    </>
  );

  const shared =
    "flex items-center gap-4 rounded-2xl border border-border p-4 shadow-soft sm:p-5";

  if (!completed) {
    return (
      <li className={cn(shared, "bg-surface-alt/60")}>{body}</li>
    );
  }

  return (
    <li>
      <Link
        href={`/results/${session.id}`}
        className={cn(
          shared,
          "panel-interactive bg-surface",
        )}
      >
        {body}
      </Link>
    </li>
  );
}
