"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Mic, Volume2, X } from "lucide-react";
import type { Language, ReminderCategory, SpeechRate } from "@prisma/client";

import { Button, LinkButton } from "@/components/ui/Button";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { parseCommand } from "@/lib/voice/commands";
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
  voicePrefs,
}: {
  items: ReminderItemDTO[];
  language: Language;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const autoReadDone = useRef(false);

  const actionable = items.filter((i) => ACTIONABLE.includes(i.state));
  const upcoming = items.filter((i) => i.state === "upcoming");
  const answered = items.filter((i) =>
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

  async function act(item: ReminderItemDTO, action: Action) {
    const key = `${item.reminderId}|${item.scheduledFor}`;
    setBusy(key);
    try {
      const response = await fetch("/api/reminders/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderId: item.reminderId,
          scheduledFor: item.scheduledFor,
          action,
        }),
      });
      if (!response.ok) throw new Error("ack failed");
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
      router.refresh();
    } catch {
      setToast(dict.errorBody);
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2500);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl leading-tight font-semibold">
          {dict.remindersTodayTitle} 🌼
        </h1>
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
          className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-lg font-medium text-success"
        >
          <Check className="size-5 shrink-0" aria-hidden />
          {toast}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center text-xl text-text-muted">
          {dict.remindersNoneToday}
        </p>
      ) : null}

      {actionable.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {actionable.map((item) => (
            <ReminderCard
              key={`${item.reminderId}|${item.scheduledFor}`}
              item={item}
              dict={dict}
              language={language}
              busy={busy === `${item.reminderId}|${item.scheduledFor}`}
              onAct={act}
            />
          ))}
        </ul>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-text-muted">
            {dict.reminderUpcomingLabel}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {upcoming.map((item) => (
              <li
                key={`${item.reminderId}|${item.scheduledFor}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4"
              >
                <span className="text-3xl" aria-hidden>
                  {REMINDER_CATEGORY_EMOJI[item.category]}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-semibold">{item.title}</span>
                  <span className="text-base text-text-muted">
                    {reminderCategoryLabel(dict, item.category)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-lg font-semibold text-text-muted">
                  <Clock className="size-5" aria-hidden />
                  {formatTimeMinutes(item.timeMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-text-muted">
            {dict.done}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {answered.map((item) => (
              <li
                key={`${item.reminderId}|${item.scheduledFor}`}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-text-muted"
              >
                <span aria-hidden>{REMINDER_CATEGORY_EMOJI[item.category]}</span>
                <span className="flex-1 text-lg line-through">{item.title}</span>
                {item.state === "done" ? (
                  <Check className="size-5 text-success" aria-hidden />
                ) : (
                  <X className="size-5" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Voice assist — never the only way; every action above is a button. */}
      {voicePrefs.voiceEnabled && voice.supported.input ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4">
          {caption ? (
            <p
              role="status"
              aria-live="polite"
              className="pointer-events-auto max-w-xs rounded-full border border-border bg-surface px-4 py-2 text-center text-base font-medium shadow-lift"
            >
              {caption}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleVoice}
            aria-label={dict.voiceTapToSpeak}
            className={cn(
              "pointer-events-auto flex size-16 items-center justify-center rounded-full border-2 shadow-lift transition-colors",
              voice.listening
                ? "animate-pulse border-primary bg-primary text-text-inverse"
                : "border-primary bg-surface text-primary hover:bg-primary-soft",
            )}
          >
            <Mic className="size-8" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
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
    <li
      className={cn(
        "rounded-2xl border-2 p-5 shadow-soft",
        missed ? "border-warning/40 bg-warning-soft" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" aria-hidden>
          {REMINDER_CATEGORY_EMOJI[item.category]}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 text-lg font-semibold text-text-muted">
            <Clock className="size-5" aria-hidden />
            {formatTimeMinutes(item.timeMinutes)}
          </span>
          <span className="mt-0.5 text-2xl font-semibold">{item.title}</span>
          <span className="text-lg text-text-muted">
            {reminderCategoryLabel(dict, item.category)}
          </span>
          {item.description ? (
            <span className="mt-1 text-base text-text-muted">
              {item.description}
            </span>
          ) : null}
          {missed ? (
            <span className="mt-2 text-base font-medium text-warning">
              {dict.reminderMissedNudge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        <div className="mt-2 flex gap-3">
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
    </li>
  );
}
