import "server-only";

import type { MemoryRecallEvent } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { caregiverLinkedTo } from "@/lib/memories/queries";
import type { LaneMemory } from "@/lib/memories/lane";
import {
  deriveState,
  dueMemories,
  type RetrievalEvent,
  type RetrievalState,
  type ScheduledMemory,
} from "@/lib/memories/retrieval";

/**
 * MEMORY LANE — the database side.
 * -----------------------------------------------------------------
 * The SCHEDULE is computed by the pure module in `retrieval.ts`. All
 * this file does is fetch the facts it folds over and check that the
 * person asking is allowed to see them.
 *
 * Nothing here decides anything about intervals, statuses or due-ness.
 * If a rule needs changing it is changed in one pure, tested place and
 * both the server and the offline device pick it up.
 */

/**
 * How much history to fold.
 *
 * The state is a fold over every event, so in principle this should be
 * unbounded. In practice a memory answered daily for a year is 365
 * rows, and the schedule after the first few dozen is determined by
 * the tail — the step only ever moves one at a time. Two hundred is
 * comfortably more than the schedule can traverse and keeps a page
 * that loads twenty memories from reading tens of thousands of rows.
 */
const EVENT_LIMIT = 200;

export interface MemoryWithSchedule {
  memory: LaneMemory;
  state: RetrievalState;
  /** Newest first, for the caregiver timeline. */
  events: MemoryRecallEvent[];
}

function toRetrievalEvents(events: MemoryRecallEvent[]): RetrievalEvent[] {
  return events.map((event) => ({
    outcome: event.outcome,
    occurredAt: event.occurredAt,
  }));
}

/**
 * Every enabled memory for one elder, with its schedule state.
 *
 * Scoped by `userId` in the query itself rather than fetched and then
 * compared, so there is no branch in which the wrong rows are read.
 */
export async function getScheduledMemories(
  userId: string,
  now: Date = new Date(),
): Promise<MemoryWithSchedule[]> {
  const memories = await prisma.personalMemory.findMany({
    where: { userId, enabled: true },
    orderBy: [{ createdAt: "asc" }],
    include: { audio: { select: { id: true } } },
  });
  if (memories.length === 0) return [];

  const events = await prisma.memoryRecallEvent.findMany({
    where: { userId, memoryId: { in: memories.map((m) => m.id) } },
    orderBy: { occurredAt: "desc" },
    take: EVENT_LIMIT * Math.min(memories.length, 10),
  });

  const byMemory = new Map<string, MemoryRecallEvent[]>();
  for (const event of events) {
    const list = byMemory.get(event.memoryId);
    if (list) list.push(event);
    else byMemory.set(event.memoryId, [event]);
  }

  return memories.map((memory) => {
    const own = (byMemory.get(memory.id) ?? []).slice(0, EVENT_LIMIT);
    return {
      memory: {
        id: memory.id,
        category: memory.category,
        title: memory.title,
        relationship: memory.relationship,
        description: memory.description,
        hasImage: memory.imagePath !== null,
        hasAudio: memory.audio !== null,
      },
      state: deriveState(toRetrievalEvents(own), now),
      events: own,
    };
  });
}

/** The shape `buildLaneSession` wants. */
export function toScheduledMemories(
  rows: MemoryWithSchedule[],
): ScheduledMemory<LaneMemory>[] {
  return rows.map((row) => ({ memory: row.memory, state: row.state }));
}

/** What Today's Journey needs to know about Memory Lane. */
export interface LaneSummary {
  /** Enabled memories this elder has at all. */
  total: number;
  /** How many are ready to be practised now. */
  dueCount: number;
  /** When the next one comes up, when nothing is due. */
  nextDueAt: Date | null;
}

/**
 * A count, for the home screen.
 *
 * Deliberately returns numbers and not memories: the home screen must
 * not carry somebody's family photographs and names in its payload
 * just to decide whether to show one line of text.
 */
export async function getLaneSummary(
  userId: string,
  now: Date = new Date(),
): Promise<LaneSummary> {
  const scheduled = await getScheduledMemories(userId, now);
  const due = dueMemories(toScheduledMemories(scheduled), now);

  const nextDueAt = scheduled
    .map((row) => row.state.dueAt)
    .filter((dueAt) => dueAt.getTime() > now.getTime())
    .reduce<Date | null>(
      (earliest, dueAt) => (!earliest || dueAt < earliest ? dueAt : earliest),
      null,
    );

  return { total: scheduled.length, dueCount: due.length, nextDueAt };
}

/**
 * The same picture, for a caregiver.
 *
 * Returns null when the caregiver is not actively linked to the elder,
 * rather than an empty list — "you may not see this" and "there is
 * nothing here" are different answers and the caller renders them
 * differently.
 */
export async function getScheduledMemoriesForCaregiver(
  caregiverId: string,
  userId: string,
  now: Date = new Date(),
): Promise<MemoryWithSchedule[] | null> {
  if (!(await caregiverLinkedTo(caregiverId, userId))) return null;
  return getScheduledMemories(userId, now);
}

/**
 * The audio record for a memory, only for someone allowed to hear it.
 *
 * Returns null for "no recording", "no such memory" and "not yours"
 * alike — the caller turns all three into the same 404, so an id
 * cannot be probed for existence.
 */
export async function getMemoryAudioFor(
  memoryId: string,
  viewer: { userId?: string | null; caregiverId?: string | null },
): Promise<{ path: string; mimeType: string } | null> {
  const memory = await prisma.personalMemory.findUnique({
    where: { id: memoryId },
    select: { userId: true, audio: { select: { path: true, mimeType: true } } },
  });
  if (!memory?.audio) return null;

  if (viewer.userId && viewer.userId === memory.userId) return memory.audio;
  if (
    viewer.caregiverId &&
    (await caregiverLinkedTo(viewer.caregiverId, memory.userId))
  ) {
    return memory.audio;
  }
  return null;
}
