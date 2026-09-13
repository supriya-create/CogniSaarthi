"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import type { Difficulty, Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { PageShell } from "@/components/layout/PageShell";
import { DifficultySelector } from "@/components/games/DifficultySelector";
import { GAME_COMPONENTS } from "@/components/games/registry";
import { LogoMark } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n/dictionaries";
import { getDefinition } from "@/lib/game-engine/definitions";
import type { GameId, SessionOutcome } from "@/lib/game-engine/types";

type Phase = "intro" | "playing" | "saving" | "failed";

/**
 * Orchestrates one activity: choose a level, open a session, play,
 * store the result, show it.
 *
 * All three games share this. A new game plugs into the registry and
 * inherits the whole lifecycle — instructions, session records,
 * scoring, the result screen — without touching this file.
 */
export function GameRunner({
  gameId,
  language,
  initialDifficulty,
}: {
  gameId: GameId;
  language: Language;
  initialDifficulty: Difficulty;
}) {
  const router = useRouter();
  const dict = getDict(language);

  const definition = getDefinition(gameId);
  const PlayComponent = GAME_COMPONENTS[gameId];

  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<SessionOutcome | null>(
    null,
  );

  if (!definition) return null;

  async function begin() {
    setPhase("saving");
    try {
      const response = await fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, difficulty }),
      });
      if (!response.ok) throw new Error("could not start");

      const data = (await response.json()) as { sessionId: string };
      setSessionId(data.sessionId);
      setPhase("playing");
    } catch {
      setPhase("failed");
    }
  }

  async function save(outcome: SessionOutcome, id: string) {
    setPendingOutcome(outcome);
    setPhase("saving");
    try {
      const response = await fetch("/api/games/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: id,
          durationMs: outcome.durationMs,
          rounds: outcome.rounds,
        }),
      });
      if (!response.ok) throw new Error("could not save");

      router.replace(`/results/${id}`);
    } catch {
      setPhase("failed");
    }
  }

  async function quit(id: string) {
    // Close the row before leaving so it is recorded as stopped
    // rather than left open forever. Navigating regardless: a person
    // who wants out should not be held by a failed request.
    try {
      await fetch("/api/games/session/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
    } catch {
      // Nothing to tell the user; they asked to leave.
    }
    router.push("/home");
  }

  // ---- playing -------------------------------------------------
  if (phase === "playing" && sessionId) {
    return (
      <PlayComponent
        config={definition.difficulties[difficulty]}
        difficulty={difficulty}
        language={language}
        onComplete={(outcome: SessionOutcome) => save(outcome, sessionId)}
        onQuit={() => void quit(sessionId)}
      />
    );
  }

  // ---- saving --------------------------------------------------
  if (phase === "saving") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6">
        <LogoMark className="size-16 motion-safe:animate-pulse" />
        <p className="text-xl text-text-muted" role="status">
          {dict.loading}
        </p>
      </div>
    );
  }

  // ---- something went wrong ------------------------------------
  if (phase === "failed") {
    return (
      <PageShell
        header={<ElderlyHeader backHref="/games" backLabel={dict.back} />}
      >
        <div className="mx-auto max-w-md py-10 text-center">
          <h1 className="font-serif text-3xl font-semibold">
            {dict.errorTitle}
          </h1>
          <p className="mt-3 text-xl text-text-muted">{dict.errorBody}</p>
          <div className="mt-8">
            <Button
              fullWidth
              icon={<RotateCcw className="size-6" aria-hidden />}
              onClick={() => {
                // Retry the step that failed, not the whole activity.
                if (pendingOutcome && sessionId) {
                  void save(pendingOutcome, sessionId);
                } else {
                  void begin();
                }
              }}
            >
              {dict.tryAgain}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ---- intro ---------------------------------------------------
  return (
    <PageShell
      header={<ElderlyHeader backHref="/games" backLabel={dict.back} />}
    >
      <div className="animate-fade-up">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-3xl shadow-soft"
          >
            {definition.glyph}
          </span>
          <h1 className="font-serif text-3xl leading-tight font-semibold">
            {definition.name[language]}
          </h1>
        </div>

        <section className="mt-7 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <h2 className="font-serif text-xl font-semibold">
            {dict.howToPlay}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-text-muted">
            {definition.instructions[language]}
          </p>
        </section>

        <section className="mt-7">
          <h2 className="font-serif text-xl font-semibold">
            {dict.chooseDifficulty}
          </h2>
          <div className="mt-4">
            <DifficultySelector
              value={difficulty}
              onChange={setDifficulty}
              dict={dict}
            />
          </div>
        </section>

        <div className="mt-8">
          <Button
            fullWidth
            onClick={begin}
            icon={<Play className="size-6" aria-hidden />}
          >
            {dict.beginActivity}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
