"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mic } from "lucide-react";
import type { Language, SpeechRate } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { COMMAND_ROUTE, parseCommand } from "@/lib/voice/commands";
import { cn } from "@/lib/utils/cn";

/**
 * A floating voice control for the elder interface. It performs a
 * small, reliable set of spoken commands — go to games, memories,
 * home, profile — and speaks a gentle reply. It is never the only way
 * to do anything: every destination is also a visible, tappable
 * control. Shown only when the person has turned voice on and the
 * device supports speech input.
 */
export function VoiceButton({
  language,
  speechRate = "NORMAL",
}: {
  language: Language;
  speechRate?: SpeechRate;
}) {
  const router = useRouter();
  const dict = getDict(language);
  const voice = useVoice({ language, rate: speechRate });
  const [caption, setCaption] = useState<string | null>(null);

  if (!voice.supported.input) return null;

  function handle() {
    setCaption(dict.listening);
    voice.listen((transcript) => {
      if (!transcript) {
        setCaption(null);
        return;
      }
      const command = parseCommand(transcript);
      if (command === "STOP") {
        voice.stopSpeaking();
        setCaption(null);
        return;
      }
      if (command === "REPEAT") {
        setCaption(dict.voiceHelp);
        voice.speak(dict.voiceHelp);
        return;
      }
      const route = command ? COMMAND_ROUTE[command] : undefined;
      if (route) {
        setCaption(dict.voiceOkay);
        voice.speak(dict.voiceOkay);
        router.push(route);
      } else {
        setCaption(dict.voiceNotUnderstood);
        voice.speak(dict.voiceNotUnderstood);
      }
    });
  }

  return (
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
        onClick={handle}
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
  );
}
