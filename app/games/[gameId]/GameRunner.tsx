"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Clock, House, Play, RotateCcw, Volume2 } from "lucide-react";
import type { Difficulty, Language, SpeechRate } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { GlowDecor } from "@/components/ui/Decor";
import { ElderlyHeader } from "@/components/layout/ElderlyHeader";
import { PageShell } from "@/components/layout/PageShell";
import { DifficultySelector } from "@/components/games/DifficultySelector";
import { GAME_COMPONENTS } from "@/components/games/registry";
import { ResultCard } from "@/components/games/ResultCard";
import { SavedLocallyBadge } from "@/components/offline/OfflineStatus";
import { LogoMark } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n/dictionaries";
import { difficultyLabel } from "@/lib/i18n/labels";
import { getDefinition } from "@/lib/game-engine/definitions";
import { toneFor } from "@/lib/game-engine/scoring";
import { ESTIMATED_MINUTES_PER_ACTIVITY } from "@/lib/cognitive-performance/config";
import { resultMessageKey } from "@/lib/cognitive-performance/recommendations";
import { useVoice } from "@/lib/voice/useVoice";
import { newId } from "@/lib/offline/serialization";
import { recordGamePlayed } from "@/lib/offline/actions";
import { useConnection } from "@/lib/offline/useOffline";
import type { GameId, SessionOutcome } from "@/lib/game-engine/types";
import type { LocalGameSession } from "@/lib/offline/types";

type Phase = "intro" | "playing" | "saving" | "result";

/**
 * Orchestrates one activity: choose a level, play, save, show the result.
 *
 * Phase 5 made this OFFLINE-FIRST. Two things changed, both in service
 * of the same rule — the elder never waits for the network:
 *
 *  1. Starting no longer blocks on the server. A session id is
 *     generated here and the "session started" row is opened in the
 *     background; if that request fails (no signal), play begins
 *     anyway. The id travels with the result later, so the server
 *     recognises the two as the same session.
 *  2. Finishing writes to this device first and shows the result
 *     immediately. Reaching the server is queued and retried in the
 *     background. The score shown here is recomputed server-side on
 *     sync, and the server's value is the one that counts.
 */
export function GameRunner({
  gameId,
  userId,
  language,
  initialDifficulty,
  voiceEnabled = false,
  autoReadInstructions = false,
  speechRate = "NORMAL",
}: {
  gameId: GameId;
  userId: string;
  language: Language;
  initialDifficulty: Difficulty;
  voiceEnabled?: boolean;
  autoReadInstructions?: boolean;
  speechRate?: SpeechRate;
}) {
  const router = useRouter();
  const dict = getDict(language);
  const voice = useVoice({ language, rate: speechRate });
  const connection = useConnection();

  const definition = getDefinition(gameId);
  const PlayComponent = GAME_COMPONENTS[gameId];
  // Plain language for what the activity helps with; the clinical
  // domain name never reaches this side of the product.
  const benefit = definition
    ? (dict[`benefit${definition.domain}` as keyof typeof dict] as
        | string
        | undefined)
    : undefined;

  // Auto-read the instructions once on the intro, if asked for.
  const spokenRef = useRef(false);
  useEffect(() => {
    if (!definition || !voiceEnabled || !autoReadInstructions) return;
    if (spokenRef.current) return;
    spokenRef.current = true;
    voice.speak(definition.instructions[language]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [phase, setPhase] = useState<Phase>("intro");
  const [saved, setSaved] = useState<LocalGameSession | null>(null);

  // Identity and start time for this play, held across the activity.
  const clientSessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  if (!definition) return null;

  function begin() {
    const clientSessionId = newId();
    clientSessionIdRef.current = clientSessionId;
    startedAtRef.current = new Date();

    // Open the server-side row in the BACKGROUND so an abandoned
    // attempt is still recorded when there is a connection. Failure is
    // fine: the same clientSessionId is sent again on sync, and the
    // server treats the two as one session.
    void fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, difficulty, clientSessionId }),
    }).catch(() => {
      // No signal. The activity starts regardless.
    });

    // Nothing is awaited — play begins at once.
    setPhase("playing");
  }

  async function save(outcome: SessionOutcome) {
    setPhase("saving");
    const session = await recordGamePlayed({
      userId,
      gameId,
      difficulty,
      language,
      rounds: outcome.rounds,
      durationMs: outcome.durationMs,
      startedAt: startedAtRef.current ?? new Date(),
      clientSessionId: clientSessionIdRef.current ?? undefined,
    });
    setSaved(session);
    setPhase("result");
  }

  function quit() {
    const id = clientSessionIdRef.current;
    if (id) {
      // Best effort only; a person who wants out is never held up.
      void fetch("/api/games/session/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSessionId: id }),
      }).catch(() => {});
    }
    router.push("/home");
  }

  // ---- playing -------------------------------------------------
  if (phase === "playing") {
    return (
      <PlayComponent
        config={definition.difficulties[difficulty]}
        difficulty={difficulty}
        language={language}
        voiceEnabled={voiceEnabled}
        speechRate={speechRate}
        onComplete={(outcome: SessionOutcome) => void save(outcome)}
        onQuit={quit}
      />
    );
  }

  // ---- saving (local write only — momentary) --------------------
  if (phase === "saving") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
        <LogoMark className="size-20 motion-safe:animate-breathe" />
        <p className="text-xl font-medium text-text-muted" role="status">
          {dict.loading}
        </p>
      </div>
    );
  }

  // ---- result (rendered from the local record, works offline) ---
  if (phase === "result" && saved) {
    const totalCount = saved.rounds.reduce((sum, r) => sum + r.total, 0);
    const correctCount = saved.rounds.reduce((sum, r) => sum + r.correct, 0);

    // Without history to hand (we may be offline), the message is
    // chosen from this session's score alone — never claiming a level
    // change the engine has not actually decided.
    const personalMessage =
      dict[
        resultMessageKey({
          score: saved.score,
          direction: "hold",
          reason: "held",
        })
      ];

    return (
      <PageShell
        header={<ElderlyHeader backHref="/home" backLabel={dict.home} />}
      >
        <p className="text-center text-base font-semibold tracking-[0.1em] text-text-muted uppercase">
          {definition.name[language]}
        </p>

        <div className="mt-5">
          <ResultCard
            tone={toneFor(saved.score)}
            stars={saved.stars}
            correctCount={correctCount}
            totalCount={totalCount}
            durationMs={saved.durationMs}
            difficultyLabel={difficultyLabel(saved.difficulty, dict)}
            dict={dict}
          />
        </div>

        <p className="mx-auto mt-6 max-w-md text-center text-lg leading-relaxed text-text-muted">
          {saved.score < 50 ? dict.resultEncourage : personalMessage}
        </p>

        {/* Quiet reassurance when there is no connection: the activity
            is safely stored here and will travel on by itself. */}
        {connection === "OFFLINE" ? (
          <p className="mt-4 flex justify-center">
            <SavedLocallyBadge language={language} />
          </p>
        ) : null}

        <p className="mt-9 text-center font-serif text-2xl font-semibold">
          {dict.resultAnotherQuestion}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            fullWidth
            icon={<RotateCcw className="size-6" aria-hidden />}
            onClick={() => {
              setSaved(null);
              clientSessionIdRef.current = null;
              setPhase("intro");
            }}
          >
            {dict.resultPlayAgain}
          </Button>
          <LinkButton
            href="/home"
            variant="outline"
            fullWidth
            icon={<House className="size-6" aria-hidden />}
          >
            {dict.resultBackHome}
          </LinkButton>
        </div>
      </PageShell>
    );
  }

  // ---- intro ---------------------------------------------------
  return (
    <PageShell header={<ElderlyHeader backHref="/games" backLabel={dict.back} />}>
      <div className="animate-fade-up">
        {/* The activity introduces itself: a large mark, the name, and
            what it is good for — the same three things the card in the
            picker showed, so arriving here feels continuous. */}
        <div className="panel surface-glow relative isolate overflow-hidden px-6 py-8 text-center">
          <GlowDecor className="-top-16 left-1/2 size-64 -translate-x-1/2" />
          <span
            aria-hidden
            className="relative mx-auto flex size-24 items-center justify-center rounded-3xl border border-border bg-surface text-5xl shadow-lift"
          >
            {definition.glyph}
          </span>
          <h1 className="relative mt-5 font-serif text-3xl leading-tight font-semibold sm:text-4xl">
            {definition.name[language]}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-lg leading-relaxed text-text-muted">
            {definition.shortDescription[language]}
          </p>
          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            <Badge
              tone="neutral"
              icon={<Clock className="size-4 shrink-0" aria-hidden />}
            >
              {dict.gameMinutesShort.replace(
                "{n}",
                String(ESTIMATED_MINUTES_PER_ACTIVITY),
              )}
            </Badge>
            {benefit ? <Badge tone="primary">{benefit}</Badge> : null}
          </div>
        </div>

        <section className="panel mt-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold">
              {dict.howToPlay}
            </h2>
            {voice.supported.output ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => voice.speak(definition.instructions[language])}
                icon={<Volume2 className="size-5" aria-hidden />}
              >
                {dict.hearAgain}
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-lg leading-relaxed text-text-muted">
            {definition.instructions[language]}
          </p>
        </section>

        <section className="mt-8">
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

        <div className="mt-9">
          <Button
            fullWidth
            size="xl"
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
