import { localDayOf } from "@/lib/reminders/timezone";
import {
  hasDecayed,
  retentionStatus,
  type RetentionStatus,
  type RetrievalState,
} from "@/lib/memories/retrieval";
import type { AlertDescriptor } from "@/lib/notifications/types";

/**
 * MEMORY LANE — when a caregiver should hear about it (pure).
 * -----------------------------------------------------------------
 * A memory slipping back one interval is an ordinary part of spaced
 * retrieval. It happens constantly, it is what the schedule is FOR,
 * and telling a caregiver about each one would turn the alert list
 * into noise and teach them to ignore it — including on the day it
 * matters.
 *
 * So the rule here is narrow, and everything about it is a threshold
 * rather than an event:
 *
 *   A memory that had genuinely reached the HOLDING step — recognised
 *   at a week or longer — has since needed help. That is a change
 *   worth one sentence.
 *
 * It reuses `AlertType.PERFORMANCE_CHANGE` rather than introducing a
 * memory-specific type: from the caregiver's side this is the same
 * kind of signal, and a new enum value would mean a new severity
 * mapping, new copy and a new thing to keep neutral.
 *
 * ## The copy boundary
 *
 * Alert text says what the ACTIVITY did, never what the person is:
 *
 *   ✓ "This memory has recently needed more reinforcement."
 *   ✗ "Memory deterioration detected."
 *
 * A test runs every sentence this module can produce through
 * `checkCopy`, so the boundary is enforced rather than remembered.
 */

/**
 * How many recent prompts are considered when deciding whether a
 * memory has really slipped, rather than having one off afternoon.
 */
export const DECAY_LOOKBACK = 3;

export interface MemoryDecaySignal {
  memoryId: string;
  /** The memory's title, shown to the caregiver who wrote it. */
  title: string;
  state: RetrievalState;
  status: RetentionStatus;
}

export interface ReinforcementContext {
  now: Date;
  timeZone: string;
  memories: MemoryDecaySignal[];
}

/** ISO-ish week stamp, matching lib/notifications/alerts.ts. */
function weekKey(now: Date, timeZone: string): string {
  const d = localDayOf(now, timeZone);
  const epochDay = Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
  return `w${Math.floor(epochDay / 7)}`;
}

/**
 * Build the retention signal for one memory. Exported so the caregiver
 * timeline and the alert derivation agree on what a status means
 * rather than each computing its own.
 */
export function signalFor(
  memoryId: string,
  title: string,
  state: RetrievalState,
): MemoryDecaySignal {
  return { memoryId, title, state, status: retentionStatus(state) };
}

/**
 * Whether this memory's change is worth surfacing.
 *
 * `hasDecayed` already requires that the memory reached the holding
 * step at some point AND that the last prompt needed help. The extra
 * condition here is that it has actually been practised enough for the
 * change to mean anything — a memory answered twice has no baseline to
 * have slipped from.
 */
export function isWorthSurfacing(signal: MemoryDecaySignal): boolean {
  if (!hasDecayed(signal.state)) return false;
  return signal.state.totalAttempts >= DECAY_LOOKBACK;
}

/**
 * At most ONE alert per week, however many memories slipped.
 *
 * Deliberately not one alert per memory: a week in which four
 * photographs needed help is one thing to tell somebody about, and
 * four separate alerts saying the same thing would read as an
 * emergency it is not. The dedupe key carries only the week, so the
 * second memory to slip does not produce a second alert.
 */
export function deriveReinforcementAlerts(
  context: ReinforcementContext,
): AlertDescriptor[] {
  const slipped = context.memories.filter(isWorthSurfacing);
  if (slipped.length === 0) return [];

  const week = weekKey(context.now, context.timeZone);

  const body =
    slipped.length === 1
      ? `“${slipped[0].title}” has recently needed more reinforcement in Memory Lane. Memory Lane will show it more often on its own. This is how one activity went, not a health measurement.`
      : `${slipped.length} memories have recently needed more reinforcement in Memory Lane. Memory Lane will show them more often on its own. This is how the activity went, not a health measurement.`;

  return [
    {
      type: "PERFORMANCE_CHANGE",
      severity: "INFO",
      // The title states what the APP did, not what the person did.
      // "A memory has needed more reinforcement" puts the subject on
      // the person by implication; "is being shown more often" is the
      // same fact with the app as the actor, which is also the more
      // useful sentence — it tells a caregiver what has changed.
      title:
        slipped.length === 1
          ? "A memory is being shown more often"
          : "Some memories are being shown more often",
      body,
      dedupeKey: `memory-reinforce:${week}`,
    },
  ];
}
