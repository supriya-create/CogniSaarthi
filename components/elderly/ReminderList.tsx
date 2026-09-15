"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellOff, Check, Clock, Volume2, X } from "lucide-react";
import type { Language, ReminderCategory, SpeechRate } from "@prisma/client";

import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoiceOrb } from "@/components/elderly/VoiceOrb";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { parseCommand } from "@/lib/voice/commands";
import { acknowledgeReminderLocally } from "@/lib/offline/actions";
import { occurrenceKey } from "@/lib/offline/serialization";
import {
  reminderOverrides,
  useConnection,
  useReminderOverrides,
} from "@/lib/offline/useOffline";
import { classifyOccurrence } from "@/lib/reminders/status";
import {
  REMINDER_CATEGORY_EMOJI,
  reminderCategoryLabel,
} from "@/lib/reminders/labels";
import { formatTimeMinutes } from "@/lib/reminders/recurrence";
import { buildSpokenReminder } from "@/lib/notifications/builder";
import { cn } from "@/lib/utils/cn";

/**
 * The elder reminder screen. Big controls, one clear card per reminder,
 * and calm language. Every reminder can be marked Done, put off (Later)
 * or Skipped — and for medication that "Done" only ever means
 * acknowledged, never "taken". Voice is an assist layered on top of the
 * touch controls, never the only way to act.
 */

export type OccurrenceState =
  | "upcoming"
  | "due"
  | "done"
  | "skipped"
  | "snoozed"
  | "missed";

export interface ReminderItemDTO {
  reminderId: string;
  scheduledFor: string; // ISO
  title: string;
  description: string | null;
  category: ReminderCategory;
  priority: "NORMAL" | "IMPORTANT";
  timeMinutes: number;
  state: OccurrenceState;
}

type Action = "DONE" | "SKIP" | "LATER";

const ACTIONABLE: OccurrenceState[] = ["due", "missed", "snoozed"];

export function ReminderList({
  items,
  language,
  dateLabel,
  voicePrefs,
}: {
  items: ReminderItemDTO[];
  language: Language;
  /** "Tuesday, 15 September", formatted on the server. */
  dateLabel: string;
  voicePrefs: {
    voiceEnabled: boolean;
    reminderVoice: boolean;
    autoReadReminders: boolean;
    speechRate: SpeechRate;
  };
}) {
  const router = useRouter();
  const dict = getDict(language);
  const voice = useVoice({ language, rate: voicePrefs.speechRate });
  const connection = useConnection();
  const overrides = useReminderOverrides();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const autoReadDone = useRef(false);

  /**
   * The server rendered this list when the page was last fetched — which,
   * offline, may have been a while ago. An answer given on this device
   * since then is layered on top, so what the person sees always matches
   * what they last did.
   */
  const resolved = items.map((item) => {
    const override = overrides[occurrenceKey(item.reminderId, item.scheduledFor)];
    if (!override) return item;
    return {
      ...item,
      state: classifyOccurrence(
        {
          scheduledFor: new Date(item.scheduledFor),
          status: override.status,
          snoozedUntil: override.snoozedUntil
            ? new Date(override.snoozedUntil)
            : null,
        },
        new Date(),
      ),
    };
  });

  const actionable = resolved.filter((i) => ACTIONABLE.includes(i.state));
  const upcoming = resolved.filter((i) => i.state === "upcoming");
  const answered = resolved.filter((i) =>
    ["done", "skipped"].includes(i.state),
  );

  function speakReminders() {
    const list = actionable.length > 0 ? actionable : upcoming;
    if (list.length === 0) {
      voice.speak(dict.remindersNoneToday);
      return;
    }
    const text = list
      .map((i) => buildSpokenReminder(dict, i.title))
      .join(". ");
    voice.speak(text);
  }

  // Auto-read on arrival, once, when the elder has that preference on.
  useEffect(() => {
    if (autoReadDone.current) return;
    if (
      voicePrefs.voiceEnabled &&
      voicePrefs.reminderVoice &&
      voicePrefs.autoReadReminders &&
      voice.supported.output &&
      actionable.length > 0
    ) {
      autoReadDone.current = true;
      speakReminders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.supported.output]);

  /**
   * Answering a reminder writes to THIS DEVICE first and confirms
   * immediately. Reaching the server is queued and retried in the
   * background, so the person gets the same instant response whether
   * or not there is a signal — and never sees a failure for something
   * that was, in fact, safely recorded.
   */
  async function act(item: ReminderItemDTO, action: Action) {
    const key = occurrenceKey(item.reminderId, item.scheduledFor);
    setBusy(key);

    await acknowledgeReminderLocally({
      reminderId: item.reminderId,
      scheduledFor: item.scheduledFor,
      action,
    });
    await reminderOverrides.refresh();

    const message =
      action === "DONE"
        ? dict.reminderMarkedDone
        : action === "LATER"
          ? dict.reminderMarkedLater
          : dict.reminderMarkedSkip;
    setToast(message);
    if (voicePrefs.voiceEnabled && voicePrefs.reminderVoice) {
      voice.speak(message);
    }

    // Re-fetch the server's view only when there is a connection to
    // re-fetch it with; offline, the local override already has it.
    if (connection !== "OFFLINE") router.refresh();

    setBusy(null);
    setTimeout(() => setToast(null), 2500);
  }

  function handleVoice() {
    if (!voice.supported.input) return;
    setCaption(dict.listening);
    voice.listen((transcript) => {
      if (!transcript) {
        setCaption(null);
        return;
      }
      const command = parseCommand(transcript);
      setCaption(null);
      if (command === "READ_REMINDERS") {
        speakReminders();
      } else if (command === "MARK_DONE" && actionable[0]) {
        act(actionable[0], "DONE");
      } else if (command === "REMIND_LATER" && actionable[0]) {
        act(actionable[0], "LATER");
      } else if (command === "STOP") {
        voice.stopSpeaking();
      } else {
        voice.speak(dict.voiceNotUnderstood);
        setCaption(dict.voiceNotUnderstood);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-[0.1em] text-text-muted uppercase">
            {dateLabel}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl leading-tight font-semibold sm:text-4xl">
            {dict.remindersTodayTitle}
          </h1>
        </div>
        {voice.supported.output ? (
          <Button
            size="md"
            variant="outline"
            onClick={speakReminders}
            icon={<Volume2 className="size-5" aria-hidden />}
          >
            {dict.reminderReadAll}
          </Button>
        ) : null}
      </div>

      {toast ? (
        <p
          role="status"
          aria-live="polite"
          className="animate-fade-up mt-5 flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success-soft px-5 py-3.5 text-lg font-semibold text-success shadow-soft"
        >
          <Check className="size-6 shrink-0" aria-hidden />
          {toast}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={dict.remindersNoneToday}
            body={dict.routineEmpty}
            icon={<BellOff className="size-10" aria-hidden />}
          />
        </div>
      ) : null}

      {actionable.length > 0 ? (
        <ol className="mt-7 flex flex-col">
          {actionable.map((item, index) => (
            <TimelineRow
              key={`${item.reminderId}|${item.scheduledFor}`}
              time={formatTimeMinutes(item.timeMinutes)}
              tone={item.state === "missed" ? "warning" : "due"}
              last={index === actionable.length - 1}
            >
              <ReminderCard
                item={item}
                dict={dict}
                language={language}
                busy={busy === `${item.reminderId}|${item.scheduledFor}`}
                onAct={act}
              />
            </TimelineRow>
          ))}
        </ol>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-9">
          <h2 className="font-serif text-xl font-semibold text-text-muted">
            {dict.reminderUpcomingLabel}
          </h2>
          <ol className="mt-4 flex flex-col">
            {upcoming.map((item, index) => (
              <TimelineRow
                key={`${item.reminderId}|${item.scheduledFor}`}
                time={formatTimeMinutes(item.timeMinutes)}
                tone="upcoming"
                last={index === upcoming.length - 1}
              >
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-soft">
                  <span className="text-3xl leading-none" aria-hidden>
                    {REMINDER_CATEGORY_EMOJI[item.category]}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg leading-tight font-semibold">
                      {item.title}
                    </span>
                    <span className="text-base text-text-muted">
                      {reminderCategoryLabel(dict, item.category)}
                    </span>
                  </span>
                </div>
              </TimelineRow>
            ))}
          </ol>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section className="mt-9">
          <h2 className="font-serif text-xl font-semibold text-text-muted">
            {dict.done}
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {answered.map((item) => (
              <li
                key={`${item.reminderId}|${item.scheduledFor}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-alt/60 px-4 py-3 text-text-muted"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    item.state === "done"
                      ? "bg-success-soft text-success"
                      : "bg-surface-sunken text-text-muted",
                  )}
                >
                  {item.state === "done" ? (
                    <Check className="size-5" strokeWidth={3} />
                  ) : (
                    <X className="size-5" strokeWidth={3} />
                  )}
                </span>
                <span className="numeric text-base font-semibold">
                  {formatTimeMinutes(item.timeMinutes)}
                </span>
                <span className="flex-1 text-lg line-through">{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Voice assist — never the only way; every action above is a button. */}
      {voicePrefs.voiceEnabled && voice.supported.input ? (
        <VoiceOrb
          listening={voice.listening}
          speaking={voice.speaking}
          caption={caption}
          listenLabel={dict.voiceTapToSpeak}
          stopLabel={dict.quitActivity}
          onActivate={handleVoice}
          onStop={() => {
            voice.stopSpeaking();
            setCaption(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * One row of the day's timeline: the time on the left, a connecting
 * line and a status dot down the middle, the reminder itself on the
 * right. The dot's shape differs per state as well as its colour, and
 * the state is always written out inside the card.
 */
function TimelineRow({
  time,
  tone,
  last,
  children,
}: {
  time: string;
  tone: "due" | "warning" | "upcoming";
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0 sm:gap-4">
      <div className="flex w-16 shrink-0 flex-col items-end pt-4 sm:w-20">
        <span className="numeric text-lg font-bold">{time}</span>
      </div>

      <div className="relative flex w-6 shrink-0 justify-center">
        {!last ? (
          <span
            aria-hidden
            className="absolute top-8 bottom-0 w-0.5 rounded-full bg-border"
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "relative z-10 mt-5 size-4 rounded-full border-2 bg-surface",
            tone === "due"
              ? "border-primary bg-primary"
              : tone === "warning"
                ? "border-warning bg-warning-soft"
                : "border-border-strong",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function ReminderCard({
  item,
  dict,
  busy,
  onAct,
}: {
  item: ReminderItemDTO;
  dict: ReturnType<typeof getDict>;
  language: Language;
  busy: boolean;
  onAct: (item: ReminderItemDTO, action: Action) => void;
}) {
  const missed = item.state === "missed";

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-5 shadow-soft",
        missed
          ? "border-warning/40 bg-warning-soft"
          : "border-border-strong bg-surface",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl border text-3xl",
            missed
              ? "border-warning/30 bg-surface/70"
              : "border-border bg-surface-alt",
          )}
        >
          {REMINDER_CATEGORY_EMOJI[item.category]}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-serif text-2xl leading-tight font-semibold">
            {item.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              {reminderCategoryLabel(dict, item.category)}
            </Badge>
            {!missed ? (
              <Badge
                tone="primary"
                size="sm"
                icon={<Clock className="size-4 shrink-0" aria-hidden />}
              >
                {dict.reminderItsTime}
              </Badge>
            ) : null}
          </span>
          {/* The nudge is a sentence, so it gets a line of its own —
              squeezed into a pill it would run off a narrow screen. */}
          {missed ? (
            <span className="mt-2 flex items-start gap-2 text-base leading-snug font-medium text-warning">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {dict.reminderMissedNudge}
            </span>
          ) : null}
          {item.description ? (
            <span className="mt-2 text-base leading-snug text-text-muted">
              {item.description}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {item.category === "COGNITIVE_ACTIVITY" ? (
          <LinkButton href="/home" size="md" variant="secondary">
            {dict.reminderStartAction}
          </LinkButton>
        ) : (
          <Button
            size="md"
            onClick={() => onAct(item, "DONE")}
            disabled={busy}
            icon={<Check className="size-5" aria-hidden />}
          >
            {dict.reminderDoneAction}
          </Button>
        )}
        <Button
          size="md"
          variant="outline"
          onClick={() => onAct(item, "LATER")}
          disabled={busy}
        >
          {dict.reminderLaterAction}
        </Button>
        <Button
          size="md"
          variant="quiet"
          onClick={() => onAct(item, "SKIP")}
          disabled={busy}
        >
          {dict.reminderSkipAction}
        </Button>
      </div>

      {item.category === "COGNITIVE_ACTIVITY" ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => onAct(item, "DONE")}
            disabled={busy}
          >
            {dict.reminderDoneAction}
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => onAct(item, "LATER")}
            disabled={busy}
          >
            {dict.reminderLaterAction}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
