"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GameStage } from "@/components/games/GameStage";
import { GameTimer } from "@/components/games/GameTimer";
import { RoundFeedback } from "@/components/games/RoundFeedback";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { storyByIndex, type Story } from "@/lib/content/stories";
import { randomIndex } from "@/lib/game-engine/random";
import type { StoryRecallConfig } from "@/lib/game-engine/definitions";
import type { GamePlayProps, RoundOutcome } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils/cn";
import type { SpeechRate } from "@prisma/client";

type Phase = "reading" | "questions" | "feedback";
const FEEDBACK_MS = 1400;

/**
 * STORY TIME — comprehension and recall (LANGUAGE domain).
 *
 * A short familiar story is shown (and can be read aloud), then a few
 * gentle multiple-choice questions. Voice is an assist for hearing
 * the story; answering is by touch so it is always reliable.
 */
export function StoryRecallGame({
  config,
  language,
  speechRate = "NORMAL",
  onComplete,
  onQuit,
}: GamePlayProps<StoryRecallConfig> & { speechRate?: SpeechRate }) {
  const dict = getDict(language);
  const voice = useVoice({ language, rate: speechRate });

  const [story] = useState<Story>(() => storyByIndex(randomIndex(2)));
  const questions = story.questions.slice(0, config.questionCount);

  const [phase, setPhase] = useState<Phase>("reading");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const outcomes = useRef<RoundOutcome[]>([]);
  const startedAt = useRef(0);
  const questionStartedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const question = questions[questionIndex];
  const answered = chosenId !== null;
  const wasCorrect = chosenId === question?.correctOptionId;

  // Advance after showing feedback.
  useEffect(() => {
    if (phase !== "feedback") return;
    const timer = window.setTimeout(() => {
      if (questionIndex + 1 < questions.length) {
        setChosenId(null);
        setQuestionIndex((i) => i + 1);
        setPhase("questions");
      } else {
        onComplete({
          durationMs: Date.now() - startedAt.current,
          rounds: outcomes.current,
        });
      }
    }, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex, questions.length]);

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [questionIndex, phase]);

  function beginQuestions() {
    voice.stopSpeaking();
    setPhase("questions");
  }

  function choose(optionId: string) {
    if (answered || !question) return;
    // Safe: only ever called from an option's onClick, not during
    // render — the compiler cannot see that through the map below.
    // eslint-disable-next-line react-hooks/purity
    const responseTimeMs = Date.now() - questionStartedAt.current;
    const correct = optionId === question.correctOptionId;
    outcomes.current.push({
      index: questionIndex,
      correct: correct ? 1 : 0,
      total: 1,
      mistakes: correct ? 0 : 1,
      hintsUsed: 0,
      responseTimeMs,
      detail: { storyId: story.id, questionId: question.id, chosen: optionId },
    });
    setChosenId(optionId);
    setPhase("feedback");
  }

  if (phase === "reading") {
    return (
      <GameStage dict={dict} round={1} totalRounds={1} onQuit={onQuit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold">
            {dict.storyReadPrompt}
          </h1>
          {voice.supported.output ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => voice.speak(story.text[language])}
              icon={<Volume2 className="size-5" aria-hidden />}
            >
              {dict.hearAgain}
            </Button>
          ) : null}
        </div>

        <p className="mt-5 rounded-2xl border border-border bg-surface p-6 text-2xl leading-relaxed shadow-soft">
          {story.text[language]}
        </p>

        <div className="mt-6">
          <GameTimer
            seconds={story.readingSeconds}
            onDone={beginQuestions}
            label={dict.memorise}
            secondsLabel={dict.seconds}
          />
        </div>

        <div className="mt-6">
          <Button
            fullWidth
            onClick={beginQuestions}
            trailingIcon={<ArrowRight className="size-6" aria-hidden />}
          >
            {dict.continueLabel}
          </Button>
        </div>
      </GameStage>
    );
  }

  if (!question) return null;

  return (
    <GameStage
      dict={dict}
      round={questionIndex + 1}
      totalRounds={questions.length}
      onQuit={onQuit}
    >
      <div>
        <p className="text-lg text-text-muted">{dict.storyQuestionsIntro}</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold">
            {question.prompt[language]}
          </h1>
          {voice.supported.output ? (
            <button
              type="button"
              onClick={() => voice.speak(question.prompt[language])}
              aria-label={dict.hearAgain}
              className="shrink-0 rounded-xl border border-border bg-surface p-2.5 text-text-muted transition-colors hover:bg-surface-alt"
            >
              <Volume2 className="size-6" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="mt-3 min-h-[3.25rem]">
          {phase === "feedback" ? (
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

      <div className="mt-4 flex flex-col gap-3">
        {question.options.map((option) => {
          const isChosen = chosenId === option.id;
          const isCorrect = option.id === question.correctOptionId;
          const reviewing = phase === "feedback";
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              disabled={reviewing}
              className={cn(
                "min-h-[4rem] rounded-2xl border-2 px-5 py-4 text-left text-xl font-semibold transition-colors duration-150",
                reviewing && isCorrect
                  ? "border-success bg-success-soft"
                  : reviewing && isChosen
                    ? "border-error bg-error-soft"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-alt",
              )}
            >
              {option.label[language]}
            </button>
          );
        })}
      </div>
    </GameStage>
  );
}
