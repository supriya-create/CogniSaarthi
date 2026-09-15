"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { House, Mic, RotateCcw, Volume2 } from "lucide-react";
import type { Language, SpeechRate } from "@prisma/client";

import { Button, LinkButton } from "@/components/ui/Button";
import { GameStage } from "@/components/games/GameStage";
import { RoundFeedback } from "@/components/games/RoundFeedback";
import { Stars } from "@/components/ui/Stars";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { matchesAnswer } from "@/lib/voice/answers";
import { starsFor } from "@/lib/game-engine/scoring";
import { recordMemoryRecallLocally } from "@/lib/offline/actions";
import type { LocalMemoryRecall } from "@/lib/offline/types";
import type { MemoryRound } from "@/lib/memories/activity";
import { cn } from "@/lib/utils/cn";

const FEEDBACK_MS = 1500;

type MemoryRecallOutcome = LocalMemoryRecall["outcome"];
type MemoryRecallMode = LocalMemoryRecall["mode"];

/**
 * Save what happened, quietly.
 *
 * Fire-and-forget on purpose. This is "remembering together", not a
 * test, so nothing about recording an answer may reach the screen —
 * no spinner, no saved tick, and above all no error. A failure here
 * leaves the answer queued on the device; it must never interrupt
 * somebody looking at a photograph of their daughter.
 *
 * Deliberately at module scope rather than inside the component. It
 * reads the clock, and React Compiler's purity rule is right to reject
 * an impure call in render scope — hoisting it is the fix, not a
 * waiver, and it makes the function independently readable besides.
 */
function recordRecallEvent(
  memoryId: string,
  outcome: MemoryRecallOutcome,
  mode: MemoryRecallMode,
  presentedAt: number | null,
): void {
  void recordMemoryRecallLocally({
    memoryId,
    outcome,
    mode,
    // Null, not zero, when we never saw the round appear — zero would
    // read as "answered instantly".
    responseTimeMs: presentedAt === null ? null : Date.now() - presentedAt,
  }).catch(() => {
    // Swallowed deliberately — see above.
  });
}

/**
 * The elder's personal recall activity: a photo of someone or
 * somewhere they know, a simple question, and a few choices. Answering
 * by touch always works; if voice is on, they can also just say the
 * answer. It is warm and never keeps score in their face — the tone
 * is "remembering together", not a test.
 *
 * Since Phase 8 each answer IS recorded, as a MemoryRecallEvent. Two
 * things about that matter and are enforced below:
 *
 *  - It is invisible. Recording is local-first and fire-and-forget:
 *    no spinner, no confirmation, no error can reach this screen. The
 *    moment somebody feels they are being measured while looking at a
 *    photograph of their daughter, this activity has failed.
 *  - It records a MOMENT, not an ability. "NOT_RECOGNISED" means one
 *    prompt, one afternoon — never a conclusion, and nothing in the
 *    product turns it into one.
 *
 * The events are the foundation the Memory Lane spaced-retrieval
 * scheduler will read. That scheduler does not exist yet, so nothing
 * here schedules, repeats or adapts anything.
 */
export function MemoryActivity({
  rounds,
  language,
  voiceEnabled = false,
  speechRate = "NORMAL",
}: {
  rounds: MemoryRound[];
  language: Language;
  voiceEnabled?: boolean;
  speechRate?: SpeechRate;
}) {
  const router = useRouter();
  const dict = getDict(language);
  const voice = useVoice({ language, rate: speechRate });

  const [index, setIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  const round = rounds[index];
  const answered = chosenId !== null;
  const advanceRef = useRef<number | null>(null);

  /**
   * When the current round appeared, for `responseTimeMs`. A ref, not
   * state: nothing renders from it, and it must not cause a re-render
   * mid-round. Set from an effect rather than during render, which
   * would be a purity violation the compiler rejects.
   */
  const presentedAtRef = useRef<number | null>(null);

  useEffect(() => {
    presentedAtRef.current = Date.now();
  }, [index]);

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    };
  }, []);

  function answer(optionId: string, correct: boolean, mode: MemoryRecallMode) {
    if (answered || !round) return;
    setChosenId(optionId);
    if (correct) setCorrectCount((c) => c + 1);

    recordRecall(
      round.memoryId,
      correct ? "RECOGNISED" : "NOT_RECOGNISED",
      mode,
    );

    advanceRef.current = window.setTimeout(() => {
      if (index + 1 < rounds.length) {
        setChosenId(null);
        setVoiceHint(null);
        setIndex((i) => i + 1);
      } else {
        setFinished(true);
      }
    }, FEEDBACK_MS);
  }

  /** Record against the moment this round appeared. */
  function recordRecall(
    memoryId: string,
    outcome: MemoryRecallOutcome,
    mode: MemoryRecallMode,
  ) {
    recordRecallEvent(memoryId, outcome, mode, presentedAtRef.current);
  }

  function chooseOption(optionId: string) {
    if (!round) return;
    answer(optionId, optionId === round.memoryId, "CHOICE");
  }

  function quit() {
    // Leaving mid-round is recorded as SKIPPED, never as a wrong
    // answer. Conflating the two would turn "I'd rather stop" into
    // "she could not remember her daughter" in the record.
    if (round && !answered) {
      recordRecall(round.memoryId, "SKIPPED", "CHOICE");
    }
    router.push("/memories");
  }

  function listen() {
    if (!round) return;
    setVoiceHint(dict.listening);
    voice.listen((transcript) => {
      setVoiceHint(null);
      if (transcript && matchesAnswer(transcript, round.acceptedAnswers)) {
        answer(round.memoryId, true, "VOICE");
      } else if (transcript) {
        // Gentle: show the words heard, let them try touch. No penalty.
        setVoiceHint(`“${transcript}”`);
      }
    });
  }

  if (finished) {
    const stars = starsFor(rounds.length ? correctCount / rounds.length : 0);
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="animate-pop font-serif text-4xl font-semibold">
          {dict.memoryActivityDone}
        </p>
        <p className="mt-4 text-xl text-text-muted">
          {dict.resultAccuracy}: {correctCount} {dict.ofTotal} {rounds.length}
        </p>
        <div className="mt-6">
          <Stars count={stars} label={dict.resultStarsLabel} ofLabel={dict.ofTotal} />
        </div>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button
            fullWidth
            icon={<RotateCcw className="size-6" aria-hidden />}
            onClick={() => {
              setIndex(0);
              setChosenId(null);
              setCorrectCount(0);
              setFinished(false);
            }}
          >
            {dict.resultPlayAgain}
          </Button>
          <LinkButton
            href="/memories"
            variant="outline"
            fullWidth
            icon={<House className="size-6" aria-hidden />}
          >
            {dict.resultBackHome}
          </LinkButton>
        </div>
      </div>
    );
  }

  if (!round) return null;

  const prompt = dict[round.promptKey] as string;

  return (
    <GameStage
      dict={dict}
      round={index + 1}
      totalRounds={rounds.length}
      onQuit={quit}
    >
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{prompt}</h1>
        {voice.supported.output ? (
          <button
            type="button"
            onClick={() => voice.speak(prompt)}
            aria-label={dict.hearAgain}
            className="shrink-0 cursor-pointer rounded-full border border-border bg-surface p-3 text-text-muted shadow-soft transition-colors duration-200 hover:bg-surface-alt hover:text-text"
          >
            <Volume2 className="size-6" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <span className="flex size-56 items-center justify-center overflow-hidden rounded-3xl border-2 border-border bg-surface-alt shadow-float sm:size-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/memories/${round.memoryId}/image`}
            alt=""
            className="size-full object-cover"
          />
        </span>
      </div>

      <div className="mt-4 min-h-[3rem] text-center">
        {answered ? (
          <RoundFeedback
            correct={chosenId === round.memoryId}
            correctLabel={dict.correct}
            wrongLabel={dict.notQuite}
          />
        ) : voiceHint ? (
          <p className="text-lg text-text-muted">{voiceHint}</p>
        ) : (
          <p className="text-lg text-text-muted">{dict.tapToAnswer}</p>
        )}
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {round.options.map((option) => {
          const isCorrect = option.id === round.memoryId;
          const isChosen = option.id === chosenId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              onClick={() => chooseOption(option.id)}
              className={cn(
                "min-h-[4.25rem] cursor-pointer rounded-2xl border-2 px-4 py-4 text-xl font-semibold",
                "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out-soft",
                answered && isCorrect
                  ? "border-success bg-success-soft shadow-lift"
                  : answered && isChosen
                    ? "border-error bg-error-soft"
                    : "border-border bg-surface shadow-soft hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-alt hover:shadow-lift",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {voiceEnabled && voice.supported.input && !answered ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={listen}
            disabled={voice.listening}
            icon={<Mic className="size-6" aria-hidden />}
          >
            {voice.listening ? dict.listening : dict.speakAnswer}
          </Button>
        </div>
      ) : null}
    </GameStage>
  );
}
