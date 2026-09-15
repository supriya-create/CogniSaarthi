import {
  Check,
  Circle,
  HelpCircle,
  MapPin,
  Mic,
  Package,
  SkipForward,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MemoryCategory, MemoryRecallOutcome } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import { fill, type CaregiverDict } from "@/lib/i18n/caregiver";
import {
  intervalLabel,
  retentionStatus,
  type RetentionStatus,
  type RetrievalState,
} from "@/lib/memories/retrieval";

/**
 * The caregiver's view of how one elder's memories are travelling
 * through Memory Lane.
 *
 * Every word here is chosen to describe THE SCHEDULE and not the
 * person. "Holding" means the gaps have widened to a week or more.
 * "Needs reinforcement" means the schedule has narrowed them again. A
 * caregiver reading this should come away knowing what the app is
 * doing, and should not come away with an impression about their
 * mother's health — the explanatory line above the list says so
 * explicitly rather than leaving it to be inferred.
 *
 * There is no score, no percentage and no trend line, deliberately.
 * Those invite exactly the reading this must not support.
 */

const CATEGORY_ICON: Record<MemoryCategory, LucideIcon> = {
  PERSON: Users,
  PLACE: MapPin,
  THING: Package,
  MOMENT: Sparkles,
};

/**
 * Each status gets a tone AND a word AND an icon. Colour never carries
 * a status on its own — an amber pill and a green pill are the same
 * pill to a person with deuteranopia on a bright screen.
 */
const STATUS_TONE: Record<
  RetentionStatus,
  "neutral" | "primary" | "success" | "accent"
> = {
  NEW: "neutral",
  LEARNING: "primary",
  BUILDING: "primary",
  HOLDING: "success",
  NEEDS_REINFORCEMENT: "accent",
};

/** Most in need of attention first; settled memories last. */
const STATUS_ORDER: RetentionStatus[] = [
  "NEEDS_REINFORCEMENT",
  "LEARNING",
  "BUILDING",
  "HOLDING",
  "NEW",
];

const OUTCOME_ICON: Record<MemoryRecallOutcome, LucideIcon> = {
  RECOGNISED: Check,
  ASSISTED: HelpCircle,
  NOT_RECOGNISED: Circle,
  SKIPPED: SkipForward,
};

const OUTCOME_TONE: Record<MemoryRecallOutcome, string> = {
  RECOGNISED: "text-success",
  ASSISTED: "text-text-muted",
  NOT_RECOGNISED: "text-text-muted",
  SKIPPED: "text-text-faint",
};

export interface RetentionEvent {
  id: string;
  outcome: MemoryRecallOutcome;
  intervalStep: number | null;
  occurredAt: Date;
}

export interface RetentionRow {
  id: string;
  title: string;
  relationship: string | null;
  category: MemoryCategory;
  enabled: boolean;
  hasAudio: boolean;
  state: RetrievalState;
  /** Newest first, as the server returns them. */
  events: RetentionEvent[];
}

/** "3 days", "1 minute" — translated, never composed in English here. */
function intervalText(dict: CaregiverDict, step: number | null): string | null {
  if (step === null) return null;
  const { unit, value } = intervalLabel(step);
  if (unit === "second") return fill(dict.intervalSeconds, { n: value });
  if (unit === "minute") {
    return value === 1
      ? dict.intervalOneMinute
      : fill(dict.intervalMinutes, { n: value });
  }
  return value === 1 ? dict.intervalOneDay : fill(dict.intervalDays, { n: value });
}

export function MemoryRetention({
  rows,
  dict,
  locale,
  now,
}: {
  rows: RetentionRow[];
  dict: CaregiverDict;
  locale: string;
  now: Date;
}) {
  const sorted = [...rows].sort((a, b) => {
    const byStatus =
      STATUS_ORDER.indexOf(retentionStatus(a.state)) -
      STATUS_ORDER.indexOf(retentionStatus(b.state));
    if (byStatus !== 0) return byStatus;
    // Within a status, whichever is due soonest comes first.
    return a.state.dueAt.getTime() - b.state.dueAt.getTime();
  });

  return (
    <ul className="mt-6 grid gap-4 lg:grid-cols-2">
      {sorted.map((row) => (
        <RetentionCard
          key={row.id}
          row={row}
          dict={dict}
          locale={locale}
          now={now}
        />
      ))}
    </ul>
  );
}

function RetentionCard({
  row,
  dict,
  locale,
  now,
}: {
  row: RetentionRow;
  dict: CaregiverDict;
  locale: string;
  now: Date;
}) {
  const status = retentionStatus(row.state);
  const Icon = CATEGORY_ICON[row.category];
  // Oldest first, so the card reads as a history going forwards.
  const history = [...row.events].reverse();
  const due = row.state.dueAt.getTime() <= now.getTime();

  return (
    // `min-w-0`, because a grid item defaults to `min-width: auto` and
    // therefore refuses to shrink below its own content. The status
    // pill does not wrap by design, so on a 375px phone this card
    // insisted on being 525px wide and took the page sideways with it.
    <li className="panel flex min-w-0 flex-col p-5">
      {/* Wraps, so the pill drops under the name on a narrow screen
          rather than competing with it for the same line. */}
      <div className="flex flex-wrap items-start gap-x-3.5 gap-y-2">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-alt text-primary"
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-serif text-xl font-semibold">
            {row.title}
          </p>
          <p className="truncate text-base text-text-muted">
            {row.relationship ?? dict[`memoryCat${row.category}` as const]}
          </p>
        </div>

        <Badge tone={STATUS_TONE[status]} size="sm">
          {dict[`retention${status}` as const]}
        </Badge>
      </div>

      <p className="mt-2.5 text-sm text-text-muted">
        {dict[`retention${status}Help` as const]}
      </p>

      {history.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-alt/40 px-4 py-3 text-sm text-text-muted">
          {dict.memoryLaneNoHistory}
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-1.5">
          {history.map((event) => {
            const OutcomeIcon = OUTCOME_ICON[event.outcome];
            const interval = intervalText(dict, event.intervalStep);
            return (
              <li
                key={event.id}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 text-base"
              >
                <OutcomeIcon
                  className={`size-4 shrink-0 translate-y-0.5 ${OUTCOME_TONE[event.outcome]}`}
                  strokeWidth={2.4}
                  aria-hidden
                />
                <span className="font-medium">
                  {dict[`outcome${event.outcome}` as const]}
                </span>
                {interval ? (
                  <span className="text-text-muted">— {interval}</span>
                ) : null}
                <span className="numeric ml-auto shrink-0 text-sm text-text-faint">
                  {event.occurredAt.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5 text-sm text-text-muted">
        <span>
          {due
            ? dict.memoryLaneDueNow
            : fill(dict.memoryLaneNextDue, {
                when: row.state.dueAt.toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                }),
              })}
        </span>
        {row.hasAudio ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Mic className="size-3.5" aria-hidden />
            {dict.voiceHas}
          </span>
        ) : null}
        {!row.enabled ? (
          <span className="text-text-faint">{dict.memoryLaneNotEnabled}</span>
        ) : null}
      </div>
    </li>
  );
}
