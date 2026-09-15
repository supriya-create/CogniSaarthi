"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  HelpCircle,
  House,
  Mic,
  RotateCcw,
  Volume2,
} from "lucide-react";
import type { Language, SpeechRate } from "@prisma/client";

import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GameStage } from "@/components/games/GameStage";
import { FamiliarVoiceButton } from "@/components/elderly/FamiliarVoiceButton";
import { GlowDecor, LeafSprig, OrchidSprig } from "@/components/ui/Decor";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { matchesAnswer } from "@/lib/voice/answers";
import { recordMemoryRecallLocally } from "@/lib/offline/actions";
import { memoryRecalls, useCachedMemories, useLocalRecalls } from "@/lib/offline/useOffline";
import type { LocalMemoryRecall } from "@/lib/offline/types";
import {
  appendRepeat,
  buildLaneSession,
  type LaneMemory,
  type LaneRound,
} from "@/lib/memories/lane";
import { deriveState, type RetrievalEvent } from "@/lib/memories/retrieval";
import { cn } from "@/lib/utils/cn";

/**
 * MEMORY LANE — the elder experience.
 * -----------------------------------------------------------------
 * Spaced retrieval with errorless learning, which in practice means
 * two rules that govern every line below:
 *
 *  1. **Nobody is ever told they were wrong.** There is no red cross,
 *     no failure sound, no "incorrect". When an answer does not come
 *     the app supplies it warmly — "This is Meera. Your daughter." —
 *     offers the caregiver's own voice saying it, and promises to come
 *     back to it. Which it then does, in this same sitting.
 *
 *  2. **There is a way out of guessing.** "I'm not sure" is a first-
 *     class button sitting beside the options, because the whole point
 *     of errorless learning is that somebody should not have to guess
 *     wrong to find out. Pressing it is recorded as ASSISTED — neither
 *     a right answer nor a wrong one — and is treated exactly as
 *     gently by the schedule.
 *
 * ## Where the schedule comes from
 *
 * The server renders this page with the memories and the recall
 * history it knows about. The SITTING, though, is built on the client
 * at the moment the person presses Start, folding in the answers held
 * on this device — including any given offline that have not reached
 * the server yet. Without that, a sitting played offline this morning
 * would be invisible to the one played this afternoon and the same
 * photographs would come round again as if nothing had happened.
 *
 * Building it on a press rather than during render is also what keeps
 * the sitting stable: nothing about it can change under somebody
 * halfway through.
 */

/** How long the warm confirmation sits before the next prompt. */
const CONFIRM_MS = 1400;

/**
 * Save one answer, quietly.
 *
 * Fire-and-forget on purpose, exactly as the plain recall activity
 * does: this is "remembering together", not a test, so nothing about
 * recording an answer may reach the screen — no spinner, no saved
 * tick, and above all no error. A failure leaves the answer queued on
 * the device.
 *
 * At module scope rather than inside the component because it reads
 * the clock, and React Compiler's purity rule is right to reject an
 * impure call in render scope. Hoisting is the fix, not a waiver.
 */
function recordLaneAnswer(
  round: LaneRound,
  outcome: LocalMemoryRecall["outcome"],
  mode: LocalMemoryRecall["mode"],
  presentedAt: number | null,
): void {
  void recordMemoryRecallLocally({
    memoryId: round.memoryId,
    outcome,
    mode,
    presentation: round.mode,
    intervalStep: round.step,
    // Null, not zero, when the round's appearance was never seen —
    // zero would read as "answered instantly".
    responseTimeMs: presentedAt === null ? null : Date.now() - presentedAt,
  })
    .then(() => memoryRecalls.refresh())
    .catch(() => {
      // Swallowed deliberately — see above.
    });
}

/**
 * Build one sitting from everything this device knows.
 *
 * Also at module scope, and for the same reason: it reads the clock
 * and shuffles. It is only ever called from the Start press, never
 * during render, so the sitting cannot change under somebody.
 */
function buildSitting(
  available: LaneMemory[],
  serverEvents: readonly LaneEventDTO[],
  localEvents: readonly LocalMemoryRecall[],
) {
  const now = new Date();
  const events = mergeEvents(serverEvents, localEvents);

  return buildLaneSession(
    available.map((memory) => ({
      memory,
      state: deriveState(events.get(memory.id) ?? [], now),
    })),
    now,
  );
}

export interface LaneEventDTO {
  clientEventId: string;
  memoryId: string;
  outcome: LocalMemoryRecall["outcome"];
  occurredAt: string;
}

type Phase = "intro" | "asking" | "confirming" | "correcting" | "done";

export function MemoryLane({
  memories,
  serverEvents,
  language,
  voiceEnabled = false,
  speechRate = "NORMAL",
}: {
  memories: LaneMemory[];
  serverEvents: LaneEventDTO[];
  language: Language;
  voiceEnabled?: boolean;
  speechRate?: SpeechRate;
}) {
  const router = useRouter();
  const dict = getDict(language);
  const voice = useVoice({ language, rate: speechRate });

  // The local replica. Both stores render empty on the server and
  // reconcile after hydration through useSyncExternalStore, so there
  // is no setState-in-effect and no flash of the wrong content.
  const localRecalls = useLocalRecalls();
  const cached = useCachedMemories();

  const [phase, setPhase] = useState<Phase>("intro");
  const [rounds, setRounds] = useState<LaneRound[]>([]);
  const [index, setIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [recognised, setRecognised] = useState(0);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  /** Memories already re-presented once, so a miss cannot loop. */
  const repeatedRef = useRef<Set<string>>(new Set());
  const advanceRef = useRef<number | null>(null);
  const presentedAtRef = useRef<number | null>(null);

  /**
   * Prefer what this device holds over what the page was rendered
   * with: the HTML may have come out of the offline cache and be days
   * old, in which case a memory a caregiver disabled yesterday would
   * otherwise reappear.
   */
  const available: LaneMemory[] = cached.length > 0
    ? cached.map((memory) => ({
        id: memory.id,
        category: memory.category,
        title: memory.title,
        relationship: memory.relationship,
        description: memory.description,
        hasImage: memory.hasImage,
        hasAudio: memory.hasAudio,
      }))
    : memories;

  useEffect(() => {
    presentedAtRef.current = Date.now();
  }, [index, phase]);

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    };
  }, []);

  const round = rounds[index] ?? null;

  /** Build a sitting from everything this device knows right now. */
  function start() {
    const session = buildSitting(available, serverEvents, localRecalls);
    repeatedRef.current = new Set();
    setRounds(session.rounds);
    setIndex(0);
    setChosenId(null);
    setRecognised(0);
    setPhase(session.rounds.length > 0 ? "asking" : "done");
  }

  function record(
    current: LaneRound,
    outcome: LocalMemoryRecall["outcome"],
    mode: LocalMemoryRecall["mode"],
  ) {
    recordLaneAnswer(current, outcome, mode, presentedAtRef.current);
  }

  function goNext() {
    setChosenId(null);
    setVoiceHint(null);
    if (index + 1 < rounds.length) {
      setIndex(index + 1);
      setPhase("asking");
    } else {
      setPhase("done");
    }
  }

  /**
   * A miss: show the answer, and queue the memory to come back.
   *
   * Appending to the END of the sitting rather than repeating it
   * immediately is deliberate — an immediate repeat is a copying
   * exercise, whereas a few prompts later it is a recall with the
   * answer still within reach, which is the whole idea.
   */
  function missed(
    current: LaneRound,
    outcome: "NOT_RECOGNISED" | "ASSISTED",
    optionId: string | null,
  ) {
    setChosenId(optionId);
    record(current, outcome, "CHOICE");

    // The rule — once only, and rebuilt one step easier — lives in
    // `appendRepeat` so it is testable without a browser.
    setRounds(appendRepeat(rounds, current, available, repeatedRef.current));
    repeatedRef.current.add(current.memoryId);

    setPhase("correcting");
  }

  function choose(optionId: string) {
    if (!round || phase !== "asking") return;

    if (optionId === round.correctOptionId) {
      setChosenId(optionId);
      setRecognised((n) => n + 1);
      record(round, "RECOGNISED", "CHOICE");
      setPhase("confirming");
      advanceRef.current = window.setTimeout(goNext, CONFIRM_MS);
      return;
    }

    missed(round, "NOT_RECOGNISED", optionId);
  }

  function notSure() {
    if (!round || phase !== "asking") return;
    missed(round, "ASSISTED", null);
  }

  function listen() {
    if (!round) return;
    setVoiceHint(dict.listening);
    voice.listen((transcript) => {
      setVoiceHint(null);
      if (transcript && matchesAnswer(transcript, round.acceptedAnswers)) {
        setChosenId(round.correctOptionId);
        setRecognised((n) => n + 1);
        record(round, "RECOGNISED", "VOICE");
        setPhase("confirming");
        advanceRef.current = window.setTimeout(goNext, CONFIRM_MS);
      } else if (transcript) {
        // Show the words heard and let them try by touch. Never a
        // penalty: speech recognition mishears, and being told you
        // were wrong by a microphone is the worst version of this.
        setVoiceHint(`“${transcript}”`);
      }
    });
  }

  function quit() {
    // Leaving mid-prompt is SKIPPED, never a wrong answer. Conflating
    // the two would turn "I'd rather stop" into "she could not
    // remember her daughter" in the record.
    if (round && phase === "asking") record(round, "SKIPPED", "CHOICE");
    router.push("/memories");
  }

  // ---------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------

  if (available.length === 0) {
    return (
      <LaneFrame dict={dict}>
        <EmptyState
          title={dict.laneEmptyTitle}
          body={dict.laneEmptyBody}
          icon={<Heart className="size-10" aria-hidden />}
          action={
            <LinkButton href="/memories" variant="outline" fullWidth>
              {dict.back}
            </LinkButton>
          }
        />
      </LaneFrame>
    );
  }

  if (phase === "intro") {
    return (
      <LaneFrame dict={dict}>
        <section className="panel surface-glow relative isolate overflow-hidden p-6 text-center sm:p-9">
          <GlowDecor className="-top-20 -left-16 size-72" tone="primary" />
          <OrchidSprig className="pointer-events-none absolute -right-8 -bottom-8 !size-48 opacity-25" />

          <div className="relative flex flex-col items-center">
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary shadow-soft"
            >
              <LeafSprig className="size-12" />
            </span>

            <h1 className="mt-6 font-serif text-3xl font-semibold sm:text-4xl">
              {dict.laneTitle}
            </h1>
            <p className="mt-3 text-xl text-text-muted">{dict.laneInvite}</p>
            <p className="mt-1.5 max-w-sm text-lg text-text-muted">
              {dict.laneSubtitle}
            </p>

            <div className="mt-8 w-full max-w-xs">
              <Button
                size="xl"
                fullWidth
                onClick={start}
                icon={<ArrowRight className="size-6 shrink-0" aria-hidden />}
              >
                {dict.laneOpen}
              </Button>
            </div>
          </div>
        </section>
      </LaneFrame>
    );
  }

  if (phase === "done") {
    // Reached either by finishing a sitting or by starting one when
    // nothing is due. The two say different things, because "you have
    // finished" and "there is nothing yet" are different facts.
    const finished = rounds.length > 0;
    return (
      <LaneFrame dict={dict}>
        <section className="panel relative isolate overflow-hidden p-6 text-center sm:p-9">
          <LeafSprig className="pointer-events-none absolute -right-10 -bottom-10 !size-48 rotate-12 opacity-[0.12]" />
          <div className="relative flex flex-col items-center">
            <span
              aria-hidden
              className={cn(
                "flex size-20 items-center justify-center rounded-full border shadow-soft",
                finished
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-border bg-surface-alt text-primary",
              )}
            >
              {finished ? (
                <Check className="size-10" strokeWidth={2.4} />
              ) : (
                <Heart className="size-9" />
              )}
            </span>

            <h1 className="mt-6 animate-pop font-serif text-3xl font-semibold sm:text-4xl">
              {finished ? dict.laneDone : dict.laneNothingDueTitle}
            </h1>
            <p className="mt-3 max-w-sm text-lg text-text-muted">
              {finished ? dict.laneDoneBody : dict.laneNothingDueBody}
            </p>

            {/* A count of what went well, and deliberately nothing
                else: no total, no percentage, no stars. "Four" is a
                warm fact; "four out of seven" is a mark out of seven. */}
            {finished && recognised > 0 ? (
              <p className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-success/30 bg-success-soft px-5 py-2 text-lg font-semibold text-success">
                <Check className="size-5 shrink-0" aria-hidden />
                {recognised}
              </p>
            ) : null}

            <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
              {finished ? (
                <Button
                  fullWidth
                  variant="outline"
                  onClick={start}
                  icon={<RotateCcw className="size-6" aria-hidden />}
                >
                  {dict.laneAgain}
                </Button>
              ) : (
                // A quiet day is the schedule working, not a dead end.
                // Free practice over the same photographs is offered
                // instead, so "nothing is due" never means "go away".
                <LinkButton href="/memories/remember" fullWidth>
                  {dict.memoryActivityStart}
                </LinkButton>
              )}
              <LinkButton
                href="/memories"
                variant={finished ? "primary" : "outline"}
                fullWidth
                icon={<House className="size-6" aria-hidden />}
              >
                {dict.resultBackHome}
              </LinkButton>
            </div>
          </div>
        </section>
      </LaneFrame>
    );
  }

  if (!round) return null;

  const promptText = (dict[round.promptKey] as string).replace(
    "{value}",
    round.promptValue ?? "",
  );
  const showPhoto = round.showPhotoFirst || phase !== "asking";

  return (
    <GameStage
      dict={dict}
      round={index + 1}
      totalRounds={rounds.length}
      onQuit={quit}
    >
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-2xl leading-tight font-semibold sm:text-3xl">
          {phase === "correcting" ? dict.laneInvite : promptText}
        </h1>
        {voice.supported.output ? (
          <button
            type="button"
            onClick={() => voice.speak(promptText)}
            aria-label={dict.hearAgain}
            className="shrink-0 cursor-pointer rounded-full border border-border bg-surface p-3 text-text-muted shadow-soft transition-colors duration-200 hover:bg-surface-alt hover:text-text"
          >
            <Volume2 className="size-6" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex justify-center">
        <MemoryPhoto
          memoryId={round.memoryId}
          visible={showPhoto && round.answer.hasImage}
          tone={phase === "correcting" ? "warm" : "plain"}
        />
      </div>

      {phase === "correcting" ? (
        <Correction
          round={round}
          dict={dict}
          onContinue={goNext}
          onSpeak={() =>
            voice.speak(
              `${dict.laneThisIs.replace("{value}", round.answer.title)}${
                round.answer.relationship
                  ? ` ${dict.laneYour.replace("{value}", round.answer.relationship)}`
                  : ""
              }`,
            )
          }
          canSpeak={voice.supported.output}
        />
      ) : (
        <>
          <div className="mt-4 min-h-[2.75rem] text-center">
            {phase === "confirming" ? (
              <p className="animate-pop inline-flex items-center gap-2.5 rounded-full border border-success/30 bg-success-soft px-5 py-2 text-lg font-semibold text-success">
                <Check className="size-5 shrink-0" aria-hidden />
                {dict.correct}
              </p>
            ) : voiceHint ? (
              <p className="text-lg text-text-muted">{voiceHint}</p>
            ) : (
              <p className="text-lg text-text-muted">{dict.tapToAnswer}</p>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {round.options.map((option) => {
              const isCorrect = option.id === round.correctOptionId;
              const isChosen = option.id === chosenId;
              const answered = phase !== "asking";
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={answered}
                  onClick={() => choose(option.id)}
                  className={cn(
                    "min-h-[4.5rem] cursor-pointer rounded-2xl border-2 px-5 py-4 text-xl font-semibold",
                    "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out-soft",
                    // Only ever marks the RIGHT one. A chosen-but-wrong
                    // option is left exactly as it was — there is no
                    // red state anywhere in Memory Lane.
                    answered && isCorrect
                      ? "border-success bg-success-soft text-success shadow-lift"
                      : answered && isChosen
                        ? "border-border-strong bg-surface-alt"
                        : "border-border bg-surface shadow-soft hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-tint hover:shadow-lift",
                    answered && !isCorrect && !isChosen && "opacity-60",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {phase === "asking" ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {/* The errorless escape hatch. Quiet, but never hidden:
                  somebody should not have to guess wrong to be told. */}
              <Button
                variant="quiet"
                size="md"
                onClick={notSure}
                icon={<HelpCircle className="size-5" aria-hidden />}
              >
                {dict.laneNotSure}
              </Button>

              {voiceEnabled && voice.supported.input ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={listen}
                  disabled={voice.listening}
                  icon={<Mic className="size-5" aria-hidden />}
                >
                  {voice.listening ? dict.listening : dict.speakAnswer}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </GameStage>
  );
}

/**
 * The errorless correction.
 *
 * Everything about it is warm on purpose: a soft tinted panel rather
 * than an alert, the person's own caregiver's voice if it was
 * recorded, and a sentence promising to come back to it — which the
 * sitting then actually does. There is no cross, no "wrong", and no
 * word anywhere that names this as a failure.
 */
function Correction({
  round,
  dict,
  onContinue,
  onSpeak,
  canSpeak,
}: {
  round: LaneRound;
  dict: ReturnType<typeof getDict>;
  onContinue: () => void;
  onSpeak: () => void;
  canSpeak: boolean;
}) {
  return (
    <div className="mt-6 animate-fade-up">
      <div className="panel relative isolate overflow-hidden border-secondary/25 bg-secondary-soft/60 p-6 text-center sm:p-7">
        <OrchidSprig className="pointer-events-none absolute -top-6 -right-6 !size-40 opacity-25" />

        <div className="relative">
          <p className="font-serif text-3xl leading-tight font-semibold">
            {dict.laneThisIs.replace("{value}", round.answer.title)}
          </p>
          {round.answer.relationship ? (
            <p className="mt-2 text-xl font-medium text-text-muted">
              {dict.laneYour.replace("{value}", round.answer.relationship)}
            </p>
          ) : null}
          {round.answer.description ? (
            <p className="mt-3 text-lg leading-relaxed text-text-muted">
              {round.answer.description}
            </p>
          ) : null}

          {round.answer.hasAudio || canSpeak ? (
            <div className="mt-6 flex justify-center">
              <FamiliarVoiceButton
                memoryId={round.memoryId}
                hasAudio={round.answer.hasAudio}
                label={
                  round.answer.hasAudio ? dict.laneHearVoice : dict.laneHear
                }
                playingLabel={dict.laneVoicePlaying}
                onFallback={onSpeak}
              />
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-5 text-center text-lg text-text-muted">
        {dict.laneComeBack}
      </p>

      <div className="mt-5">
        <Button
          size="xl"
          fullWidth
          onClick={onContinue}
          icon={<ArrowRight className="size-6 shrink-0" aria-hidden />}
        >
          {dict.continueLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * The photograph.
 *
 * Hidden before the answer only in NAME_RECALL, where showing it would
 * BE the answer; revealed in every other mode and always revealed
 * during the correction. When it is hidden — or when this memory has
 * no photograph at all — the frame stays and holds a sprig instead, so
 * the layout does not jump when the picture appears.
 *
 * `alt` is empty on purpose. The photograph carries no information a
 * screen-reader user can act on, and the one description that could be
 * generated is the memory's own title, which is the answer to the
 * question being asked.
 */
function MemoryPhoto({
  memoryId,
  visible,
  tone,
}: {
  memoryId: string;
  visible: boolean;
  tone: "plain" | "warm";
}) {
  return (
    <span
      className={cn(
        "flex size-56 items-center justify-center overflow-hidden rounded-3xl border-2 shadow-float transition-colors duration-300 sm:size-64",
        tone === "warm"
          ? "border-secondary/40 bg-secondary-soft"
          : "border-border bg-surface-alt",
      )}
    >
      {visible ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/memories/${memoryId}/image`}
          alt=""
          className="size-full animate-fade-in object-cover"
        />
      ) : (
        <LeafSprig className="size-24 opacity-50" aria-hidden />
      )}
    </span>
  );
}

/**
 * The page frame outside a live sitting.
 *
 * A real `<main id="main">`, because the skip link at the root points
 * at `#main` and a page without one sends a keyboard user nowhere. The
 * live sitting gets its own from `GameStage`; these screens are
 * outside it and were briefly missing one.
 */
function LaneFrame({
  dict,
  children,
}: {
  dict: ReturnType<typeof getDict>;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6"
    >
      <Link
        href="/memories"
        className="inline-flex min-h-[3rem] items-center gap-1.5 rounded-lg px-1 py-1 text-base font-semibold text-text-muted transition-colors hover:text-text"
      >
        ← {dict.back}
      </Link>
      <div className="mt-4">{children}</div>
    </main>
  );
}

/**
 * Merge the server's history with this device's, keyed by event id.
 *
 * Both sides carry `clientEventId`, so an answer the server already
 * has and the device has not yet retired appears once, not twice —
 * which matters, because each event moves the schedule a step.
 */
function mergeEvents(
  serverEvents: readonly LaneEventDTO[],
  localEvents: readonly LocalMemoryRecall[],
): Map<string, RetrievalEvent[]> {
  const seen = new Set<string>();
  const byMemory = new Map<string, RetrievalEvent[]>();

  function add(memoryId: string, clientEventId: string, outcome: LocalMemoryRecall["outcome"], occurredAt: string) {
    if (seen.has(clientEventId)) return;
    seen.add(clientEventId);
    const event: RetrievalEvent = {
      outcome,
      occurredAt: new Date(occurredAt),
    };
    const list = byMemory.get(memoryId);
    if (list) list.push(event);
    else byMemory.set(memoryId, [event]);
  }

  for (const event of localEvents) {
    add(event.memoryId, event.clientEventId, event.outcome, event.occurredAt);
  }
  for (const event of serverEvents) {
    add(event.memoryId, event.clientEventId, event.outcome, event.occurredAt);
  }

  return byMemory;
}
