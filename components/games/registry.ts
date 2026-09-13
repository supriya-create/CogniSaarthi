/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from "react";

import { RememberObjectsGame } from "@/components/games/RememberObjectsGame";
import { FindDifferentGame } from "@/components/games/FindDifferentGame";
import { RememberSequenceGame } from "@/components/games/RememberSequenceGame";
import type { GameId, GamePlayProps } from "@/lib/game-engine/types";

/**
 * Maps a game id to the component that plays it.
 *
 * Each game has its own configuration shape, so the map is
 * necessarily heterogeneous — the single `any` here is the one place
 * that is admitted, and `getDefinition(id).difficulties[difficulty]`
 * is guaranteed by construction to be the config that component
 * expects. Registering a fourth game is one import and one line.
 */
export const GAME_COMPONENTS: Record<
  GameId,
  ComponentType<GamePlayProps<any>>
> = {
  "remember-objects": RememberObjectsGame,
  "find-different": FindDifferentGame,
  "remember-sequence": RememberSequenceGame,
};
