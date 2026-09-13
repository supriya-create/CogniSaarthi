"use client";

import { useEffect, useRef, useState } from "react";

import { GameStage } from "@/components/games/GameStage";
import { ObjectTile, type TileState } from "@/components/games/ObjectTile";
import { RoundFeedback } from "@/components/games/RoundFeedback";
import { getDict } from "@/lib/i18n/dictionaries";
import {
  pairsBySimilarity,
  type OddPair,
} from "@/lib/game-engine/content/odd-one-out";
import { randomIndex, sample } from "@/lib/game-engine/random";
import type { FindDifferentConfig } from "@/lib/game-engine/definitions";
import type { GamePlayProps, RoundOutcome } from "@/lib/game-engine/types";

const FEEDBACK_MS = 1400;

type Round = { pair: OddPair; oddIndex: number };

/** Built once on mount — see the note in RememberObjectsGame. */
function buildRounds(config: FindDifferentConfig): Round[] {
  const pool = pairsBySimilarity(config.similarity);

  // sample() caps at the pool size, so top up when more rounds are
  // asked for than there are distinct pairs available.
  const picked: OddPair[] = [];
  while (picked.length < config.rounds && pool.length > 0) {
    picked.push(...sample(pool, config.rounds - picked.length));
  }

  return picked.slice(0, config.rounds).map((pair) => ({
    pair,
    oddIndex: randomIndex(config.tileCount),
  }));
}

/**
 * GAME 2 — attention.
 *
 * One attempt per round: tapping settles the answer. Letting a
 * person hunt until they hit the right tile would measure
 * persistence, not attention, and would make the score meaningless.
 */
export function FindDifferentGame({
  config,
  language,
  onComplete,
  onQuit,
}: GamePlayProps<FindDifferentConfig>) {
  const dict = getDict(language);

  const [rounds] = useState(() => buildRounds(config));
  const [roundIndex, setRoundIndex] = useState(0);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);

  const outcomes = useRef<RoundOutcome[]>([]);
  const startedAt = useRef(0);
  const roundStartedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    roundStartedAt.current = Date.now();
  }, [roundIndex]);

  const round = rounds[roundIndex];
  const answered = chosenIndex !== null;
  const wasCorrect = chosenIndex === round?.oddIndex;

  // Advance once the feedback has had a moment to be read.
  useEffect(() => {
    if (!answered) return;

    const timer = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setChosenIndex(null);
        setRoundIndex((i) => i + 1);
      } else {
        onComplete({
          durationMs: Date.now() - startedAt.current,
          rounds: outcomes.current,
        });
      }
    }, FEEDBACK_MS);

    return () => window.clearTimeout(timer);
    // onComplete is stable for the life of the activity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, roundIndex, rounds.length]);

  function choose(index: number) {
    if (answered || !round) return;

    // Reading the clock here is safe: `choose` only ever runs from a
    // tile's onClick. The compiler cannot see that through the inline
    // arrow inside the map below, so the rule is waived explicitly
    // rather than the code being bent around it.
    // eslint-disable-next-line react-hooks/purity
    const responseTimeMs = Date.now() - roundStartedAt.current;

    const correct = index === round.oddIndex;
    outcomes.current.push({
      index: roundIndex,
      correct: correct ? 1 : 0,
      total: 1,
      mistakes: correct ? 0 : 1,
      hintsUsed: 0,
      responseTimeMs,
      detail: {
        pairId: round.pair.id,
        similarity: round.pair.similarity,
        tileCount: config.tileCount,
        oddIndex: round.oddIndex,
        chosenIndex: index,
      },
    });
    setChosenIndex(index);
  }

  if (!round) return null;

  // Spotting the odd one out depends on seeing the whole group at
  // once, so the grid keeps its shape at every width and the tiles
  // shrink instead of the rows wrapping into a scroll.
  const columns =
    config.tileCount >= 16
      ? "grid-cols-4"
      : config.tileCount >= 9
        ? "grid-cols-3"
        : "grid-cols-2 sm:grid-cols-3";

  function tileState(index: number): TileState {
    if (!answered || !round) return "idle";
    if (index === round.oddIndex) return "correct";
    if (index === chosenIndex) return "wrong";
    return "muted";
  }

  return (
    <GameStage
      dict={dict}
      round={roundIndex + 1}
      totalRounds={rounds.length}
      onQuit={onQuit}
    >
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          {dict.findDifferentPrompt}
        </h1>
        <div className="mt-3 min-h-[3.25rem]">
          {answered ? (
            <RoundFeedback
              correct={wasCorrect}
              correctLabel={dict.correct}
              wrongLabel={dict.notQuite}
            />
          ) : (
            <p className="text-lg text-text-muted">{dict.tapToAnswer}</p>
          )}
        </div>
      </div>

      <div className={`mt-5 grid content-start gap-3 ${columns}`}>
        {Array.from({ length: config.tileCount }, (_, index) => {
          const isOdd = index === round.oddIndex;
          const item = isOdd ? round.pair.odd : round.pair.base;
          return (
            <ObjectTile
              key={index}
              glyph={item.glyph}
              label={item.label[language]}
              state={tileState(index)}
              onClick={() => choose(index)}
              disabled={answered}
              showLabel={false}
            />
          );
        })}
      </div>
    </GameStage>
  );
}
