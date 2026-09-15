/**
 * MEMORY LANE — the spaced-retrieval scheduler.
 * -----------------------------------------------------------------
 * Pure TypeScript. No React, no Prisma, no network, and no clock of
 * its own: every function that depends on "now" is handed it. That is
 * what makes the whole schedule unit-testable, and — more usefully —
 * what lets the SAME code run on the server and on a device with no
 * connection and still agree about when a memory is next due.
 *
 * ## What this is, and what it is not
 *
 * This is spaced retrieval: showing somebody a personally meaningful
 * photograph at gradually widening gaps, and widening the next gap
 * when they recognise it. It is a practice schedule for everyday
 * memory assistance.
 *
 * It is NOT a treatment, a diagnosis, or a measurement of anybody's
 * memory. A step number is a position in a practice schedule. It is
 * not a score, it is never shown to the elder, and the caregiver side
 * renders it as a product state ("Holding") rather than a number.
 *
 * ## The failure rule
 *
 * A miss steps BACK one interval — it never resets to the beginning
 * and never punishes. Someone who has recognised their daughter at
 * seven days and misses once at fourteen goes back to seven, not to
 * twenty seconds. Errorless learning is the other half of that, and
 * it lives in the UI: the correct answer is shown immediately, and
 * the memory is re-presented shortly afterwards.
 */

/**
 * The expanding schedule, centralised so there is exactly one place to
 * change it.
 *
 * The first three are deliberately measured in seconds and minutes.
 * That is the part of spaced retrieval people find surprising, and it
 * matters: the first successful recall has to happen while the answer
 * is still reachable, otherwise the first experience of the feature is
 * a failure. Twenty seconds, then a minute, then five, all inside one
 * sitting — and only then does the schedule start counting in days.
 */
export const RETRIEVAL_INTERVALS_MS: readonly number[] = [
  20 * 1000, // 20 seconds
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  24 * 60 * 60 * 1000, // 1 day
  3 * 24 * 60 * 60 * 1000, // 3 days
  7 * 24 * 60 * 60 * 1000, // 7 days
  14 * 24 * 60 * 60 * 1000, // 14 days
  30 * 24 * 60 * 60 * 1000, // 30 days
] as const;

/** The last index in the schedule. A success here stays here. */
export const MAX_STEP = RETRIEVAL_INTERVALS_MS.length - 1;
/** The first index. A miss here stays here — there is no below. */
export const MIN_STEP = 0;

/**
 * How a recall prompt went.
 *
 * These mirror `MemoryRecallOutcome` in the schema, with `RECOGNISED`
 * as the success value rather than a renamed `SUCCESS` — the events
 * table already uses that name and already holds rows written under
 * it. Renaming the concept in one layer only would leave two words for
 * one thing, which is how the two eventually disagree.
 *
 * `ASSISTED` is the Memory Lane addition and carries the errorless
 * half of the design: the person did not produce the answer, so they
 * were shown it, kindly, and will see the memory again shortly. It is
 * NOT a wrong answer and it is NOT a right one, and collapsing it into
 * either would lose the distinction the caregiver timeline depends on.
 */
export type RetrievalOutcome =
  | "RECOGNISED"
  | "ASSISTED"
  | "NOT_RECOGNISED"
  | "SKIPPED";

/** One recorded answer, reduced to only what the schedule needs. */
export interface RetrievalEvent {
  outcome: RetrievalOutcome;
  /** When the person answered, on their own device. */
  occurredAt: Date;
}

/**
 * Where one memory currently sits in the schedule.
 *
 * Deliberately derived, never stored: the events ARE the record, and a
 * second persisted copy of the state would be a thing that can drift
 * out of step with them — which, on a device that has been offline for
 * a week, it certainly would.
 */
export interface RetrievalState {
  /** Index into RETRIEVAL_INTERVALS_MS. */
  step: number;
  /** When this memory next wants to be shown. */
  dueAt: Date;
  /** The most recent answer, or null when it has never been shown. */
  lastOutcome: RetrievalOutcome | null;
  /** When it was last shown, or null. */
  lastSeenAt: Date | null;
  /** Consecutive recognitions ending now. Reset by anything else. */
  streak: number;
  /** How many times it has been answered at all. */
  totalAttempts: number;
  /**
   * The highest step ever REACHED by recognising at the step below it.
   * Kept because decay is only meaningful relative to a peak: dropping
   * to 7 days matters when somebody had reached 30, and means nothing
   * when they have never been past 3.
   */
  peakStep: number;
}

/** The interval attached to a step, clamped to the schedule. */
export function intervalFor(step: number): number {
  return RETRIEVAL_INTERVALS_MS[clampStep(step)];
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return MIN_STEP;
  return Math.min(MAX_STEP, Math.max(MIN_STEP, Math.trunc(step)));
}

/**
 * A memory nobody has answered yet.
 *
 * Due immediately rather than in twenty seconds: the schedule starts
 * when the first prompt is ANSWERED, and a memory a caregiver added
 * this morning should be available this morning.
 */
export function initialState(now: Date): RetrievalState {
  return {
    step: MIN_STEP,
    dueAt: new Date(now.getTime()),
    lastOutcome: null,
    lastSeenAt: null,
    streak: 0,
    totalAttempts: 0,
    peakStep: MIN_STEP,
  };
}

/**
 * Apply one answer to a state.
 *
 * The whole schedule rule, in one function:
 *
 *   RECOGNISED      step + 1 (capped), wait the new, longer interval
 *   ASSISTED        step − 1 (floored), come back SOON
 *   NOT_RECOGNISED  step − 1 (floored), come back SOON
 *   SKIPPED         step unchanged, come back soon — "I'd rather not"
 *                   is not evidence about memory and must never move
 *                   the schedule as though it were.
 *
 * "Soon" after a miss is the FIRST interval, not the stepped-back one.
 * The stepped-back step is where the schedule resumes from after the
 * next success; the immediate re-presentation is what makes the
 * correction stick, and waiting three days for it would waste the
 * moment the answer was just given.
 */
export function advance(
  state: RetrievalState,
  outcome: RetrievalOutcome,
  now: Date,
): RetrievalState {
  const attempts = state.totalAttempts + 1;
  const seenAt = new Date(now.getTime());

  if (outcome === "SKIPPED") {
    return {
      ...state,
      lastOutcome: outcome,
      lastSeenAt: seenAt,
      streak: 0,
      totalAttempts: attempts,
      // Offer it again in this sitting, without moving the schedule.
      dueAt: new Date(now.getTime() + RETRIEVAL_INTERVALS_MS[MIN_STEP]),
    };
  }

  if (outcome === "RECOGNISED") {
    const step = clampStep(state.step + 1);
    return {
      step,
      dueAt: new Date(now.getTime() + intervalFor(step)),
      lastOutcome: outcome,
      lastSeenAt: seenAt,
      streak: state.streak + 1,
      totalAttempts: attempts,
      peakStep: Math.max(state.peakStep, step),
    };
  }

  // ASSISTED or NOT_RECOGNISED — step back, and come back shortly.
  const step = clampStep(state.step - 1);
  return {
    step,
    dueAt: new Date(now.getTime() + RETRIEVAL_INTERVALS_MS[MIN_STEP]),
    lastOutcome: outcome,
    lastSeenAt: seenAt,
    streak: 0,
    totalAttempts: attempts,
    peakStep: state.peakStep,
  };
}

/**
 * Fold a memory's whole history into its current state.
 *
 * Sorts by `occurredAt` first, because events arrive out of order: a
 * tablet that was offline on Tuesday pushes Tuesday's answer after
 * Wednesday's, and a schedule that depended on arrival order would put
 * the memory in a different place depending on the weather. Ties are
 * broken by the order given, so the fold is fully deterministic.
 */
export function deriveState(
  events: readonly RetrievalEvent[],
  now: Date,
): RetrievalState {
  const ordered = [...events]
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const byTime = a.event.occurredAt.getTime() - b.event.occurredAt.getTime();
      return byTime !== 0 ? byTime : a.index - b.index;
    });

  let state = initialState(now);
  for (const { event } of ordered) {
    state = advance(state, event.outcome, event.occurredAt);
  }
  return state;
}

// ---------------------------------------------------------------
// Due-ness
// ---------------------------------------------------------------

export function isDue(state: RetrievalState, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}

/** How long a memory has been waiting. Negative when not yet due. */
export function overdueByMs(state: RetrievalState, now: Date): number {
  return now.getTime() - state.dueAt.getTime();
}

export interface ScheduledMemory<T> {
  memory: T;
  state: RetrievalState;
}

/**
 * The memories to practise now, most overdue first.
 *
 * Ordering by overdue-ness rather than by due time puts the thing that
 * has waited longest in front of somebody who only has the patience
 * for two prompts today. Ties fall back to the earlier due time and
 * then to the order given, so a session is reproducible.
 */
export function dueMemories<T>(
  scheduled: readonly ScheduledMemory<T>[],
  now: Date,
  limit?: number,
): ScheduledMemory<T>[] {
  const due = scheduled
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isDue(item.state, now))
    .sort((a, b) => {
      const byOverdue =
        overdueByMs(b.item.state, now) - overdueByMs(a.item.state, now);
      if (byOverdue !== 0) return byOverdue;
      const byDue = a.item.state.dueAt.getTime() - b.item.state.dueAt.getTime();
      return byDue !== 0 ? byDue : a.index - b.index;
    })
    .map(({ item }) => item);

  return limit === undefined ? due : due.slice(0, Math.max(0, limit));
}

// ---------------------------------------------------------------
// Retention status — a PRODUCT state, not a clinical one
// ---------------------------------------------------------------

/**
 * How a memory is travelling through the schedule.
 *
 * Every one of these describes the SCHEDULE, not the person. "Needs
 * reinforcement" means this photograph is being shown again more
 * often; it does not mean anybody is getting worse, and the caregiver
 * copy says so in as many words.
 */
export type RetentionStatus =
  | "NEW"
  | "LEARNING"
  | "BUILDING"
  | "HOLDING"
  | "NEEDS_REINFORCEMENT";

/**
 * The step at which a memory counts as holding: 7 days.
 *
 * Chosen because it is the first interval that spans a change of
 * routine — a week includes the days somebody's family visits and the
 * days they do not — so recognising at seven days is meaningfully
 * different from recognising twice in one afternoon.
 */
export const HOLDING_STEP = 5;
/** 1 day: past the within-sitting intervals, into real spacing. */
export const BUILDING_STEP = 3;

/**
 * Whether a memory has slipped from a level it had genuinely reached.
 *
 * Both halves are required, and the second one is the important one:
 * having REACHED the holding step at some point, and having missed the
 * most recent prompt. Without the peak check, a memory somebody has
 * never recognised would be reported as "needs reinforcement", which
 * says something untrue about a photograph nobody has practised yet.
 */
export function hasDecayed(state: RetrievalState): boolean {
  if (state.peakStep < HOLDING_STEP) return false;
  return state.lastOutcome === "NOT_RECOGNISED" || state.lastOutcome === "ASSISTED";
}

export function retentionStatus(state: RetrievalState): RetentionStatus {
  if (state.totalAttempts === 0) return "NEW";
  if (hasDecayed(state)) return "NEEDS_REINFORCEMENT";
  if (state.step >= HOLDING_STEP) return "HOLDING";
  if (state.step >= BUILDING_STEP) return "BUILDING";
  return "LEARNING";
}

/**
 * Label an interval for the caregiver timeline: "3 days", "1 minute".
 *
 * Returns the parts rather than a sentence so the caller can translate
 * it — a formatted English string here would be untranslatable copy
 * generated deep inside a scheduler.
 */
export interface IntervalLabel {
  unit: "second" | "minute" | "day";
  value: number;
}

export function intervalLabel(step: number): IntervalLabel {
  const ms = intervalFor(step);
  if (ms < 60 * 1000) return { unit: "second", value: Math.round(ms / 1000) };
  if (ms < 24 * 60 * 60 * 1000) {
    return { unit: "minute", value: Math.round(ms / 60_000) };
  }
  return { unit: "day", value: Math.round(ms / 86_400_000) };
}
