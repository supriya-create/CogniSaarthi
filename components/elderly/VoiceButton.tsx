"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Language, SpeechRate } from "@prisma/client";

import { VoiceOrb } from "@/components/elderly/VoiceOrb";
import { getDict } from "@/lib/i18n/dictionaries";
import { useVoice } from "@/lib/voice/useVoice";
import { COMMAND_ROUTE, parseCommand } from "@/lib/voice/commands";

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
    <VoiceOrb
      listening={voice.listening}
      speaking={voice.speaking}
      caption={caption}
      listenLabel={dict.voiceTapToSpeak}
      stopLabel={dict.quitActivity}
      onActivate={handle}
      onStop={() => {
        voice.stopSpeaking();
        setCaption(null);
      }}
    />
  );
}
