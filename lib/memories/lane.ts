import type { MemoryCategory } from "@prisma/client";

import { shuffle } from "@/lib/game-engine/random";
import { FILLER } from "@/lib/memories/activity";
import { buildDistractors, type LabelledOption } from "@/lib/memories/options";
import {
  dueMemories,
  type RetrievalState,
  type ScheduledMemory,
} from "@/lib/memories/retrieval";

/**
 * MEMORY LANE — building one practice session (pure).
 * -----------------------------------------------------------------
 * Takes the memories a person has, the schedule state each one is in,
 * and produces the ordered prompts for one sitting. No React, no
 * database, no clock — `now` is passed in — so the same function runs
 * on the server and on an offline device and produces the same
 * session.
 *
 * Two things about the design are deliberate and load-bearing:
 *
 *  1. **The mode is chosen by the schedule step, not at random.** A
 *     memory somebody is still learning is always asked the easiest
 *     way — photograph in front of them, "Who is this?". Harder modes
 *     (no photograph, recall the relationship) only appear once the
 *     memory has survived a real interval. Randomising this would mean
 *     somebody's first ever prompt could be the hardest one, which is
 *     the opposite of errorless learning.
 *
 *  2. **A session is capped and never mandatory.** Memory Lane is an
 *     optional part of the day. A list of thirty overdue photographs
 *     is a chore, and a chore gets abandoned.
 */

/** How many prompts one sitting offers at most. */
export const SESSION_LIMIT = 6;

/**
 * How a memory is being asked about.
 *
 * Mirrors the `MemoryPresentationMode` enum in the schema, so what is
 * shown and what is recorded cannot drift into two vocabularies.
 */
export type PresentationMode =
  | "PERSON_RECOGNITION"
  | "NAME_RECALL"
  | "RELATIONSHIP_RECALL"
  | "PLACE_RECOGNITION"
  | "CONTEXT_RECALL";

/** The memory fields Memory Lane needs. Matches the offline cache. */
export interface LaneMemory {
  id: string;
  category: MemoryCategory;
  title: string;
  relationship: string | null;
  description: string | null;
  hasImage: boolean;
  /** A caregiver has recorded a familiar voice for this memory. */
  hasAudio: boolean;
}

export type LanePromptKey =
  | "memoryWhoIsThis"
  | "memoryWhatPlace"
  | "memoryWhatThing"
  | "memoryWhatMoment"
  | "laneAskName"
  | "laneAskRelationship";

/** One prompt in a session. */
export interface LaneRound {
  memoryId: string;
  category: MemoryCategory;
  mode: PresentationMode;
  promptKey: LanePromptKey;
  /** Substituted into the prompt for the modes that need it. */
  promptValue: string | null;
  /**
   * Whether the photograph is shown BEFORE an answer is given. False
   * only for NAME_RECALL, where the photograph would be the answer.
   * It is always revealed afterwards.
   */
  showPhotoFirst: boolean;
  /** The step this prompt was presented at, recorded with the answer. */
  step: number;
  correctOptionId: string;
  correctLabel: string;
  /** Labels accepted for a spoken answer. */
  acceptedAnswers: string[];
  options: LabelledOption[];
  /** The errorless correction, shown when the answer does not come. */
  answer: LaneAnswer;
}

/**
 * What the person is shown when they miss.
 *
 * Assembled here rather than in the component so the sentence is one
 * piece of data — "This is Meera." / "Your daughter." — and the screen
 * cannot accidentally render a half of it, or reach for the raw
 * memory record and print something the prompt was not about.
 */
export interface LaneAnswer {
  title: string;
  relationship: string | null;
  description: string | null;
  hasImage: boolean;
  hasAudio: boolean;
}

/** Neutral filler relationships, only to top up a short list. */
const RELATIONSHIP_FILLER = [
  "Daughter",
  "Son",
  "Sister",
  "Brother",
  "Neighbour",
  "Friend",
];

const OPTIONS_PER_ROUND = 4;

/**
 * The step from which harder modes become available: 3, the first
 * interval measured in days. Below it every prompt is plain
 * recognition with the photograph in view.
 */
export const HARDER_MODE_STEP = 3;

/**
 * Choose how to ask about this memory.
 *
 * Deterministic: the same memory at the same step is always asked the
 * same way. A person should not find the question changing shape under
 * them between one sitting and the next.
 */
export function modeFor(memory: LaneMemory, step: number): PresentationMode {
  const base: PresentationMode =
    memory.category === "PLACE"
      ? "PLACE_RECOGNITION"
      : memory.category === "PERSON"
        ? "PERSON_RECOGNITION"
        : "CONTEXT_RECALL";

  // Learning, or nothing to look at: always the gentlest form.
  if (step < HARDER_MODE_STEP || !memory.hasImage) return base;

  if (memory.category === "PERSON" && memory.relationship) {
    // Alternate the two harder person modes by step parity, so a
    // memory held for a long time is not asked the identical question
    // every single time — without ever being random about it.
    return step % 2 === 1 ? "RELATIONSHIP_RECALL" : "NAME_RECALL";
  }

  return base;
}

const PROMPT_KEY: Record<PresentationMode, LanePromptKey> = {
  PERSON_RECOGNITION: "memoryWhoIsThis",
  PLACE_RECOGNITION: "memoryWhatPlace",
  CONTEXT_RECALL: "memoryWhatMoment",
  NAME_RECALL: "laneAskName",
  RELATIONSHIP_RECALL: "laneAskRelationship",
};

/** The prompt for a THING, which shares CONTEXT_RECALL's mode. */
function promptKeyFor(mode: PresentationMode, category: MemoryCategory) {
  if (mode === "CONTEXT_RECALL" && category === "THING") {
    return "memoryWhatThing" as const;
  }
  return PROMPT_KEY[mode];
}

/**
 * Build one round.
 *
 * Exported because the elder screen re-presents a missed memory later
 * in the same sitting, and it must be able to rebuild that prompt
 * without rebuilding the whole session (which would re-pick every
 * other round's distractors too).
 */
export function buildRound(
  memory: LaneMemory,
  step: number,
  pool: readonly LaneMemory[],
  shuffleFn: <V>(items: readonly V[]) => V[] = shuffle,
): LaneRound {
  const mode = modeFor(memory, step);

  // RELATIONSHIP_RECALL asks for the relationship; everything else
  // asks for the memory's title.
  const asksRelationship = mode === "RELATIONSHIP_RECALL";
  const correctLabel = asksRelationship
    ? (memory.relationship ?? memory.title)
    : memory.title;

  const distractors = buildDistractors(
    {
      target: memory,
      pool,
      idOf: (item) => item.id,
      labelOf: (item) =>
        asksRelationship ? item.relationship : item.title,
      isSimilar: (item, target) => item.category === target.category,
      filler: asksRelationship
        ? RELATIONSHIP_FILLER
        : FILLER[memory.category],
      count: OPTIONS_PER_ROUND,
    },
    shuffleFn,
  );

  const options = shuffleFn([
    { id: memory.id, label: correctLabel },
    ...distractors,
  ]);

  // Both the name and the relationship are accepted aloud whichever
  // way the question was put: somebody answering "that's my daughter"
  // to "Who is this?" has recognised her, and marking that wrong
  // because of the grammar of the question would be absurd.
  const acceptedAnswers = [memory.title];
  if (memory.relationship) acceptedAnswers.push(memory.relationship);

  return {
    memoryId: memory.id,
    category: memory.category,
    mode,
    promptKey: promptKeyFor(mode, memory.category),
    promptValue:
      mode === "NAME_RECALL"
        ? memory.relationship
        : mode === "RELATIONSHIP_RECALL"
          ? memory.title
          : null,
    showPhotoFirst: mode !== "NAME_RECALL" && memory.hasImage,
    step,
    correctOptionId: memory.id,
    correctLabel,
    acceptedAnswers,
    options,
    answer: {
      title: memory.title,
      relationship: memory.relationship,
      description: memory.description,
      hasImage: memory.hasImage,
      hasAudio: memory.hasAudio,
    },
  };
}

export interface LaneSession {
  rounds: LaneRound[];
  /** Memories that exist but are not due yet. */
  waitingCount: number;
  /** When the next not-yet-due memory comes up; null if none. */
  nextDueAt: Date | null;
}

/**
 * Build a session from every memory and its schedule state.
 *
 * A memory with no usable title is excluded — an unanswerable prompt
 * is worse than a shorter session. A memory without a photograph is
 * kept: a name and a relationship still make a real recall prompt, and
 * excluding them would silently drop half of what a caregiver added.
 */
export function buildLaneSession(
  scheduled: readonly ScheduledMemory<LaneMemory>[],
  now: Date,
  limit = SESSION_LIMIT,
  shuffleFn: <V>(items: readonly V[]) => V[] = shuffle,
): LaneSession {
  const usable = scheduled.filter((item) => item.memory.title.trim().length > 0);
  const pool = usable.map((item) => item.memory);

  const due = dueMemories(usable, now, limit);

  const notDue = usable.filter((item) => !due.includes(item));
  const nextDueAt = notDue.reduce<Date | null>((earliest, item) => {
    if (!earliest || item.state.dueAt < earliest) return item.state.dueAt;
    return earliest;
  }, null);

  return {
    rounds: due.map((item) =>
      buildRound(item.memory, item.state.step, pool, shuffleFn),
    ),
    waitingCount: notDue.length,
    nextDueAt,
  };
}

/**
 * Queue a missed memory to come back later in the SAME sitting.
 *
 * This is the second half of errorless learning, and the reason it is
 * a function here rather than three lines in a component is that two
 * rules have to hold together and both are easy to get wrong:
 *
 *  1. **It comes back once, not forever.** Repeating a memory every
 *     time it is missed is a loop somebody cannot get out of, and the
 *     one person it would trap is the one least able to work out why.
 *  2. **It comes back EASIER.** The repeat is rebuilt at the step the
 *     memory will be at after the miss — one lower — so what returns
 *     is the gentler question, not the same hard one that just did not
 *     come.
 *
 * Appending rather than inserting next is also deliberate: an
 * immediate repeat is a copying exercise, whereas a few prompts later
 * it is a genuine recall with the answer still within reach.
 *
 * Returns the rounds unchanged when this memory has already had its
 * repeat, so the caller can use the result unconditionally.
 */
export function appendRepeat(
  rounds: readonly LaneRound[],
  missed: LaneRound,
  pool: readonly LaneMemory[],
  alreadyRepeated: ReadonlySet<string>,
  shuffleFn: <V>(items: readonly V[]) => V[] = shuffle,
): LaneRound[] {
  if (alreadyRepeated.has(missed.memoryId)) return [...rounds];

  const memory = pool.find((item) => item.id === missed.memoryId);
  if (!memory) return [...rounds];

  return [
    ...rounds,
    buildRound(memory, Math.max(0, missed.step - 1), pool, shuffleFn),
  ];
}

/** Convenience for callers holding states in a map by memory id. */
export function toScheduled(
  memories: readonly LaneMemory[],
  stateFor: (memoryId: string) => RetrievalState,
): ScheduledMemory<LaneMemory>[] {
  return memories.map((memory) => ({
    memory,
    state: stateFor(memory.id),
  }));
}
