import { MemoryLane, type LaneEventDTO } from "@/components/elderly/MemoryLane";
import { requireUser } from "@/lib/auth/current-user";
import { getScheduledMemories } from "@/lib/memories/server";
import type { LaneMemory } from "@/lib/memories/lane";
import { getDict } from "@/lib/i18n/dictionaries";

/**
 * MEMORY LANE.
 *
 * The page is thin on purpose. It fetches the person's memories and
 * the recall history the server knows about, and hands both to the
 * client — which builds the actual sitting, folding in any answers
 * given on this device that have not reached the server yet.
 *
 * `force-dynamic` because the schedule depends on the clock: a
 * statically rendered copy would say a memory is due twenty seconds
 * after whenever the page happened to be built.
 */
export const dynamic = "force-dynamic";

export default async function MemoryLanePage() {
  const user = await requireUser();
  const language = user.preference?.language ?? user.language;
  const dict = getDict(language);

  const scheduled = await getScheduledMemories(user.id);

  const memories: LaneMemory[] = scheduled.map((row) => row.memory);

  // Only what the schedule needs. No response times, no modes, no
  // interval steps — the client re-derives the schedule from the
  // outcomes, and sending the rest would put more of somebody's
  // recall history into a page than the page has any use for.
  const events: LaneEventDTO[] = scheduled.flatMap((row) =>
    row.events.map((event) => ({
      clientEventId: event.clientEventId,
      memoryId: event.memoryId,
      outcome: event.outcome,
      occurredAt: event.occurredAt.toISOString(),
    })),
  );

  return (
    <>
      {/* The title is rendered by the client component, which owns
          every state this screen has; this only exists so the
          document has a sensible name before hydration. */}
      <title>{`${dict.laneTitle} · ${dict.appName}`}</title>
      <MemoryLane
        memories={memories}
        serverEvents={events}
        language={language}
        voiceEnabled={user.preference?.voiceEnabled ?? false}
        speechRate={user.preference?.speechRate ?? "NORMAL"}
      />
    </>
  );
}
