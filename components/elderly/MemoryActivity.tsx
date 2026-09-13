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
import type { MemoryRound } from "@/lib/memories/activity";
import { cn } from "@/lib/utils/cn";

const FEEDBACK_MS = 1500;

/**
 * The elder's personal recall activity: a photo of someone or
 * somewhere they know, a simple question, and a few choices. Answering
 * by touch always works; if voice is on, they can also just say the
 * answer. It is warm and never keeps score in their face — the tone
 * is "remembering together", not a test. Results are not stored.
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

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    };
  }, []);

  function answer(optionId: string, correct: boolean) {
    if (answered || !round) return;
    setChosenId(optionId);
    if (correct) setCorrectCount((c) => c + 1);

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

  function chooseOption(optionId: string) {
    if (!round) return;
    answer(optionId, optionId === round.memoryId);
  }

  function listen() {
    if (!round) return;
    setVoiceHint(dict.listening);
    voice.listen((transcript) => {
      setVoiceHint(null);
      if (transcript && matchesAnswer(transcript, round.acceptedAnswers)) {
        answer(round.memoryId, true);
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
      onQuit={() => router.push("/memories")}
    >
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{prompt}</h1>
        {voice.supported.output ? (
          <button
            type="button"
            onClick={() => voice.speak(prompt)}
            aria-label={dict.hearAgain}
            className="shrink-0 rounded-xl border border-border bg-surface p-2.5 text-text-muted transition-colors hover:bg-surface-alt"
          >
            <Volume2 className="size-6" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <span className="flex size-56 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-alt shadow-soft">
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
                "min-h-[4rem] rounded-2xl border-2 px-4 py-4 text-xl font-semibold transition-colors duration-150",
                answered && isCorrect
                  ? "border-success bg-success-soft"
                  : answered && isChosen
                    ? "border-error bg-error-soft"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-alt",
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
