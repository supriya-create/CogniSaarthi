import { CircleCheck, CircleDashed } from "lucide-react";

import type { SessionWithResult } from "@/lib/db/queries";
import { getDefinition } from "@/lib/game-engine/definitions";
import { formatDayLabel, formatTime } from "@/lib/utils/date";
import { formatDuration } from "@/lib/utils/date";
import type { CaregiverDict } from "@/lib/i18n/caregiver";

const DIFFICULTY_KEY = {
  EASY: "difficultyEasy",
  MEDIUM: "difficultyMedium",
  HARD: "difficultyHard",
} as const;

export function RecentSessionRow({
  session,
  locale,
  dict,
}: {
  session: SessionWithResult;
  locale: string;
  dict: CaregiverDict;
}) {
  const definition = getDefinition(session.gameId);
  const completed = session.status === "COMPLETED" && session.result !== null;

  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4">
        <span className="flex items-center gap-3">
          <span aria-hidden className="text-xl">
            {definition?.glyph ?? "🧠"}
          </span>
          <span className="font-medium">{session.game.name}</span>
        </span>
      </td>
      <td className="py-3 pr-4 text-text-muted">
        {dict[DIFFICULTY_KEY[session.difficulty]]}
      </td>
      <td className="py-3 pr-4 text-right font-semibold tabular-nums">
        {completed && session.result ? `${session.result.score}%` : "—"}
      </td>
      <td className="py-3 pr-4 text-right tabular-nums text-text-muted">
        {session.durationMs ? formatDuration(session.durationMs) : "—"}
      </td>
      <td className="py-3 pr-4 text-text-muted">
        <span className="whitespace-nowrap">
          {formatDayLabel(session.startedAt, locale)},{" "}
          {formatTime(session.startedAt, locale)}
        </span>
      </td>
      <td className="py-3">
        {completed ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CircleCheck className="size-4" aria-hidden />
            {dict.statusCompleted}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted">
            <CircleDashed className="size-4" aria-hidden />
            {dict.statusNotFinished}
          </span>
        )}
      </td>
    </tr>
  );
}
