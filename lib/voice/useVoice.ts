"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Language, SpeechRate } from "@prisma/client";

import {
  cancelSpeech,
  isSpeechInputSupported,
  isSpeechOutputSupported,
  listenOnce,
  speak as speakRaw,
  type ListenController,
} from "@/lib/voice/speech";

export interface VoicePrefs {
  language: Language;
  rate: SpeechRate;
}

const noopSubscribe = () => () => {};
const returnFalse = () => false;

/**
 * React glue over the speech wrapper. Manages "speaking" and
 * "listening" state so components can show feedback, and cleans up on
 * unmount so a half-spoken instruction never trails a page change.
 */
export function useVoice(prefs: VoicePrefs) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const controllerRef = useRef<ListenController | null>(null);

  // Support is read with useSyncExternalStore: the server snapshot is
  // always false, the client snapshot the real capability. React
  // reconciles the two without a hydration mismatch, so voice-gated
  // controls render only after hydration — and there is no
  // setState-in-effect. Speech support does not change at runtime, so
  // the subscribe callback is a no-op.
  const output = useSyncExternalStore(
    noopSubscribe,
    isSpeechOutputSupported,
    returnFalse,
  );
  const input = useSyncExternalStore(
    noopSubscribe,
    isSpeechInputSupported,
    returnFalse,
  );
  const supported = { output, input };

  useEffect(() => {
    return () => {
      cancelSpeech();
      controllerRef.current?.stop();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      setSpeaking(true);
      speakRaw(text, {
        language: prefs.language,
        rate: prefs.rate,
        onEnd: () => setSpeaking(false),
      });
    },
    [prefs.language, prefs.rate],
  );

  const stopSpeaking = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  /** Listen for one phrase; resolves with the transcript ("" on fail). */
  const listen = useCallback(
    (onResult: (transcript: string) => void) => {
      if (listening) return;
      cancelSpeech();
      setListening(true);
      controllerRef.current = listenOnce({
        language: prefs.language,
        onResult: (transcript) => onResult(transcript),
        onError: () => {
          setListening(false);
          onResult("");
        },
        onEnd: () => setListening(false),
      });
      // listenOnce returns null when unsupported.
      if (!controllerRef.current) setListening(false);
    },
    [listening, prefs.language],
  );

  const stopListening = useCallback(() => {
    controllerRef.current?.stop();
    setListening(false);
  }, []);

  return {
    supported,
    speaking,
    listening,
    speak,
    stopSpeaking,
    listen,
    stopListening,
  };
}
