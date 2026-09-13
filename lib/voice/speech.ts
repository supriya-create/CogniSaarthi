import type { Language, SpeechRate } from "@prisma/client";

/**
 * A thin wrapper over the browser's Web Speech API — the only voice
 * provider in Phase 3. This is the seam: everything else in the app
 * talks to these functions, so a different engine (a cloud STT, an
 * on-device model) can replace this file without touching callers.
 *
 * Honesty about the provider:
 *  - Text-to-speech is widely available and good for English and
 *    Hindi. An Assamese ("as-IN") voice is usually NOT installed, so
 *    it falls back to whatever the browser picks.
 *  - Speech recognition is Chrome/Edge only and cloud-backed. It
 *    handles English well; Hindi varies by device; Assamese is
 *    effectively unsupported. Touch is always available as the
 *    primary path — voice is an assist, never a requirement.
 */

// --- minimal Web Speech typings (not in the default TS DOM lib) ---
interface SpeechRecognitionResultLike {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSpeechInputSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** BCP-47 tag for the speech engines. */
export function speechLocale(language: Language): string {
  return { EN: "en-IN", HI: "hi-IN", AS: "as-IN" }[language];
}

function rateValue(rate: SpeechRate): number {
  return rate === "SLOW" ? 0.8 : 1;
}

// -----------------------------------------------------------------
// Text to speech
// -----------------------------------------------------------------

export interface SpeakOptions {
  language: Language;
  rate?: SpeechRate;
  onEnd?: () => void;
}

export function speak(text: string, options: SpeakOptions): void {
  if (!isSpeechOutputSupported() || !text.trim()) {
    options.onEnd?.();
    return;
  }
  // Cancel anything mid-utterance so instructions never overlap.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(options.language);
  utterance.rate = rateValue(options.rate ?? "NORMAL");
  utterance.pitch = 1;
  if (options.onEnd) utterance.onend = () => options.onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel();
}

// -----------------------------------------------------------------
// Speech to text (one utterance at a time)
// -----------------------------------------------------------------

export interface ListenHandlers {
  language: Language;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface ListenController {
  stop: () => void;
}

/**
 * Listen for a single spoken phrase. Returns a controller to stop
 * early, or null if the browser cannot do speech input at all.
 */
export function listenOnce(handlers: ListenHandlers): ListenController | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError?.("unsupported");
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = speechLocale(handlers.language);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    handlers.onResult(transcript);
  };
  recognition.onerror = (event) => handlers.onError?.(event.error);
  recognition.onend = () => handlers.onEnd?.();

  try {
    recognition.start();
  } catch {
    handlers.onError?.("start_failed");
    return null;
  }

  return { stop: () => recognition.stop() };
}
