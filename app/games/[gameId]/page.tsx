import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { defaultDifficulty, isGameId } from "@/lib/game-engine/definitions";
import { GameRunner } from "./GameRunner";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!isGameId(gameId)) notFound();

  const user = await requireUser();

  return (
    <GameRunner
      gameId={gameId}
      language={user.preference?.language ?? user.language}
      initialDifficulty={defaultDifficulty(
        user.preference?.preferredDifficulty,
      )}
    />
  );
}
