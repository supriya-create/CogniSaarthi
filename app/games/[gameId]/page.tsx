import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { isGameId } from "@/lib/game-engine/definitions";
import { getRecommendedDifficulty } from "@/lib/cognitive-performance/profile";
import { GameRunner } from "./GameRunner";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!isGameId(gameId)) notFound();

  const user = await requireUser();

  // Phase 2: the starting level is chosen from the person's own
  // history in this game's cognitive domain, not a fixed preference.
  // Cold start (too little history) returns the gentle starting level.
  // The user can still override it on the intro screen.
  const initialDifficulty = await getRecommendedDifficulty(user.id, gameId);

  return (
    <GameRunner
      gameId={gameId}
      language={user.preference?.language ?? user.language}
      initialDifficulty={initialDifficulty}
      voiceEnabled={user.preference?.voiceEnabled ?? false}
      autoReadInstructions={user.preference?.autoReadInstructions ?? false}
      speechRate={user.preference?.speechRate ?? "NORMAL"}
    />
  );
}
