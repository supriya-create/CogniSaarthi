"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GameStage } from "@/components/games/GameStage";
import { ObjectTile } from "@/components/games/ObjectTile";
import { RoundFeedback } from "@/components/games/RoundFeedback";
import { ProgressDots } from "@/components/elderly/ProgressDots";
import { getDict } from "@/lib/i18n/dictionaries";
import { OBJECTS, type GameObject } from "@/lib/game-engine/content/objects";
import { sample, shuffle } from "@/lib/game-engine/random";
import type { RememberSequenceConfig } from "@/lib/game-engine/definitions";
import type { GamePlayProps, RoundOutcome } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils/cn";

const FEEDBACK_MS = 1600;
const GAP_MS = 320;

type Round = { sequence: GameObject[]; palette: GameObject[] };
type Phase = "watching" | "answering" | "feedback";

/** Builds every round's sequence and answer palette. */
function buildRounds(config: RememberSequenceConfig): Round[] {
  return Array.from({ length: config.rounds }, () => {
    const sequence = sample(OBJECTS, config.sequenceLength);
    const usedIds = new Set(sequence.map((o) => o.id));
    const extras = sample(
      OBJECTS.filter((o) => !usedIds.has(o.id)),
      config.paletteExtra,
    );
    return { sequence, palette: shuffle([...sequence, ...extras]) };
  });
}

/**
 * GAME 3 — working memory.
 *
 * The sequence plays back one object at a time, large and centred,
 * rather than as tiles lighting up in a grid. Following a single
 * moving point of attention is far easier than tracking flashes
 * across a board, and the task being measured is the order, not the
 * hunt for which square blinked.
 */
export function RememberSequenceGame({
  config,
  language,
  onComplete,
  onQuit,
}: GamePlayProps<RememberSequenceConfig>) {
  const dict = getDict(language);

  const [rounds] = useState(() => buildRounds(config));
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("watching");
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<string[]>([]);
  const [lastCorrect, setLastCorrect] = useState(0);

  const outcomes = useRef<RoundOutcome[]>([]);
  const startedAt = useRef(0);
  const answeringFrom = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const round = rounds[roundIndex];

  // Play the sequence back, one object per tick, then hand over.
  useEffect(() => {
    if (phase !== "watching" || !round) return;

    if (step >= round.sequence.length) {
      const timer = window.setTimeout(() => {
        answeringFrom.current = Date.now();
        setPhase("answering");
      }, GAP_MS);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => setStep((s) => s + 1),
      config.stepMs,
    );
    return () => window.clearTimeout(timer);
  }, [phase, step, round, config.stepMs]);

  function tap(object: GameObject) {
    if (phase !== "answering" || !round) return;
    if (answer.length >= round.sequence.length) return;
    setAnswer((current) => [...current, object.id]);
  }

  function undo() {
    setAnswer((current) => current.slice(0, -1));
  }

  function check() {
    if (!round) return;

    const correct = round.sequence.reduce(
      (count, object, position) =>
        answer[position] === object.id ? count + 1 : count,
      0,
    );

    outcomes.current.push({
      index: roundIndex,
      correct,
      total: round.sequence.length,
      mistakes: round.sequence.length - correct,
      hintsUsed: 0,
      responseTimeMs: Date.now() - answeringFrom.current,
      detail: {
        sequence: round.sequence.map((o) => o.id),
        answer,
        sequenceLength: round.sequence.length,
      },
    });

    setLastCorrect(correct);
    setPhase("feedback");
  }

  // Move on once the feedback has been seen.
  useEffect(() => {
    if (phase !== "feedback") return;

    const timer = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((i) => i + 1);
        setAnswer([]);
        setStep(0);
        setPhase("watching");
      } else {
        onComplete({
          durationMs: Date.now() - startedAt.current,
          rounds: outcomes.current,
        });
      }
    }, FEEDBACK_MS);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundIndex, rounds.length]);

  if (!round) return null;

  const stageProps = {
    dict,
    round: roundIndex + 1,
    totalRounds: rounds.length,
    onQuit,
  };

  if (phase === "watching") {
    const current = round.sequence[Math.min(step, round.sequence.length - 1)];
    const showing = step < round.sequence.length;

    return (
      <GameStage {...stageProps}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="font-serif text-2xl font-semibold">
            {dict.sequenceWatchPrompt}
          </h1>
          <ProgressDots
            total={round.sequence.length}
            filled={Math.min(step + (showing ? 1 : 0), round.sequence.length)}
            label={dict.sequenceWatchPrompt}
            ofLabel={dict.ofTotal}
            size="sm"
          />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          {showing ? (
            <div key={step} className="animate-pop w-48">
              <ObjectTile
                glyph={current.glyph}
                label={current.label[language]}
                size="lg"
                state="selected"
              />
              <p className="mt-4 text-center text-2xl font-semibold tabular-nums text-text-muted">
                {step + 1}
              </p>
            </div>
          ) : null}
        </div>
      </GameStage>
    );
  }

  const complete = answer.length === round.sequence.length;
  const reviewing = phase === "feedback";

  return (
    <GameStage
      {...stageProps}
      footer={
        reviewing ? undefined : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={undo}
              disabled={answer.length === 0}
              icon={<Undo2 className="size-6" aria-hidden />}
            >
              {dict.clearSelection}
            </Button>
            <Button
              fullWidth
              onClick={check}
              disabled={!complete}
              icon={<Check className="size-6" aria-hidden />}
            >
              {dict.checkAnswer}
            </Button>
          </div>
        )
      }
    >
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          {dict.sequenceAnswerPrompt}
        </h1>
        <div className="mt-3 min-h-[3.25rem]">
          {reviewing ? (
            <RoundFeedback
              correct={lastCorrect === round.sequence.length}
              correctLabel={dict.correct}
              wrongLabel={dict.notQuite}
            />
          ) : (
            <p className="text-lg text-text-muted">{dict.sequenceYourAnswer}</p>
          )}
        </div>
      </div>

      {/* The answer so far, as numbered slots. */}
      <ol className="mt-4 flex flex-wrap gap-2.5">
        {round.sequence.map((object, position) => {
          const chosenId = answer[position];
          const chosen = chosenId
            ? round.palette.find((o) => o.id === chosenId)
            : undefined;
          const isRight = reviewing && chosenId === object.id;
          const isWrong = reviewing && chosenId !== undefined && !isRight;

          return (
            <li
              key={position}
              className={cn(
                "flex size-[4.5rem] items-center justify-center rounded-xl border-2 text-3xl",
                isRight
                  ? "border-success bg-success-soft"
                  : isWrong
                    ? "border-error bg-error-soft"
                    : chosen
                      ? "border-primary bg-primary-soft"
                      : "border-dashed border-border-strong bg-surface-alt",
              )}
            >
              {chosen ? (
                <span aria-label={chosen.label[language]}>{chosen.glyph}</span>
              ) : (
                <span
                  className="text-lg font-semibold text-text-muted"
                  aria-hidden
                >
                  {position + 1}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid content-start gap-3 grid-cols-3 sm:grid-cols-4">
        {round.palette.map((object) => (
          <ObjectTile
            key={object.id}
            glyph={object.glyph}
            label={object.label[language]}
            state={
              reviewing
                ? "muted"
                : answer.includes(object.id)
                  ? "muted"
                  : "idle"
            }
            onClick={reviewing ? undefined : () => tap(object)}
            disabled={reviewing || complete || answer.includes(object.id)}
            showLabel={false}
          />
        ))}
      </div>
    </GameStage>
  );
}
