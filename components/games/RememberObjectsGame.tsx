"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GameStage } from "@/components/games/GameStage";
import { GameTimer } from "@/components/games/GameTimer";
import { ObjectTile } from "@/components/games/ObjectTile";
import { getDict } from "@/lib/i18n/dictionaries";
import { OBJECTS, type GameObject } from "@/lib/game-engine/content/objects";
import { sample, shuffle } from "@/lib/game-engine/random";
import type { RememberObjectsConfig } from "@/lib/game-engine/definitions";
import type { GamePlayProps } from "@/lib/game-engine/types";

type Phase = "viewing" | "answering";
type Content = { shown: GameObject[]; grid: GameObject[] };

/** Picks the objects to show and the grid to answer from. */
function buildContent(config: RememberObjectsConfig): Content {
  const shown = sample(OBJECTS, config.itemCount);
  const shownIds = new Set(shown.map((o) => o.id));
  const distractors = sample(
    OBJECTS.filter((o) => !shownIds.has(o.id)),
    config.distractorCount,
  );
  return { shown, grid: shuffle([...shown, ...distractors]) };
}

/**
 * GAME 1 — short-term visual memory.
 *
 * Grading rule (this game's own, applied before the shared scorer):
 * every remembered object counts one, and every object picked that
 * was never shown cancels one out. Otherwise selecting the whole
 * grid would score full marks.
 */
export function RememberObjectsGame({
  config,
  language,
  onComplete,
  onQuit,
}: GamePlayProps<RememberObjectsConfig>) {
  const dict = getDict(language);

  // A lazy initialiser runs exactly once per mount. `useMemo` would
  // not: its cache is a hint React may drop, which mid-activity would
  // silently change the grid under the person's hand.
  const [content] = useState(() => buildContent(config));

  const [phase, setPhase] = useState<Phase>("viewing");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const startedAt = useRef(0);
  const answeringFrom = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  function beginAnswering() {
    answeringFrom.current = Date.now();
    setPhase("answering");
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    const shownIds = new Set(content.shown.map((o) => o.id));
    const hits = [...selected].filter((id) => shownIds.has(id));
    const falsePositives = [...selected].filter((id) => !shownIds.has(id));

    onComplete({
      durationMs: Date.now() - startedAt.current,
      rounds: [
        {
          index: 0,
          correct: Math.max(0, hits.length - falsePositives.length),
          total: content.shown.length,
          mistakes: falsePositives.length,
          hintsUsed: 0,
          responseTimeMs: Date.now() - answeringFrom.current,
          detail: {
            shown: content.shown.map((o) => o.id),
            selected: [...selected],
            hits: hits.length,
            falsePositives: falsePositives.length,
          },
        },
      ],
    });
  }

  if (phase === "viewing") {
    return (
      <GameStage dict={dict} round={1} totalRounds={1} onQuit={onQuit}>
        <GameTimer
          seconds={config.viewSeconds}
          onDone={beginAnswering}
          label={dict.memorise}
          secondsLabel={dict.seconds}
        />

        <div className="mt-7 grid flex-1 grid-cols-2 content-start gap-3 sm:grid-cols-3">
          {content.shown.map((object) => (
            <ObjectTile
              key={object.id}
              glyph={object.glyph}
              label={object.label[language]}
              size="lg"
            />
          ))}
        </div>
      </GameStage>
    );
  }

  return (
    <GameStage
      dict={dict}
      round={1}
      totalRounds={1}
      onQuit={onQuit}
      footer={
        <Button
          fullWidth
          onClick={submit}
          icon={<Check className="size-6" aria-hidden />}
        >
          {dict.checkAnswer}
        </Button>
      }
    >
      <div className="animate-fade-up">
        <h1 className="font-serif text-2xl font-semibold">
          {dict.rememberObjectsPrompt}
        </h1>
        <p className="mt-2 text-lg text-text-muted">{dict.tapToAnswer}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
        {content.grid.map((object) => (
          <ObjectTile
            key={object.id}
            glyph={object.glyph}
            label={object.label[language]}
            state={selected.has(object.id) ? "selected" : "idle"}
            onClick={() => toggle(object.id)}
          />
        ))}
      </div>
    </GameStage>
  );
}
