"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * "Hear a familiar voice."
 *
 * When a caregiver has recorded themselves for a memory — "Ma, this is
 * Meera" — this plays THAT, through the same authenticated route the
 * photographs come through. When they have not, it falls back to the
 * app's existing text-to-speech, which is what `onFallback` does.
 *
 * There is deliberately no second voice architecture here: the
 * fallback is `useVoice`, owned by the caller, and this component only
 * knows how to play one audio element and how to give up gracefully.
 *
 * Failure is silent by design. A recording that will not play on this
 * device is a disappointment, not an error worth a red banner in front
 * of somebody who was looking at a photograph of their daughter — so
 * the button quietly falls back to the spoken sentence instead.
 */
export function FamiliarVoiceButton({
  memoryId,
  hasAudio,
  label,
  playingLabel,
  onFallback,
  className,
}: {
  memoryId: string;
  /** A caregiver recording exists for this memory. */
  hasAudio: boolean;
  label: string;
  playingLabel: string;
  /** Speak the sentence instead, when there is no recording. */
  onFallback: () => void;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play() {
    if (!hasAudio) {
      onFallback();
      return;
    }

    const element = audioRef.current;
    if (!element) {
      onFallback();
      return;
    }

    setPlaying(true);
    element.currentTime = 0;
    void element.play().catch(() => {
      // Autoplay policy, an unsupported codec, a missing file: none of
      // these are worth explaining here. Say the sentence instead.
      setPlaying(false);
      onFallback();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={play}
        aria-live="polite"
        className={cn(
          "inline-flex min-h-[3.5rem] cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 px-6 py-3.5",
          "text-lg font-semibold transition-[background-color,border-color,box-shadow] duration-200 ease-gentle",
          playing
            ? "border-secondary bg-secondary-soft text-secondary shadow-lift"
            : "border-border-strong bg-surface text-text shadow-soft hover:border-secondary/50 hover:bg-secondary-soft/60",
          className,
        )}
      >
        <Volume2
          className={cn("size-6 shrink-0", playing && "animate-breathe")}
          aria-hidden
        />
        {playing ? playingLabel : label}
      </button>

      {hasAudio ? (
        // `preload="none"`: the recording is private and is fetched
        // only when somebody actually asks to hear it, so a session
        // that never presses this never pulls anybody's voice down.
        <audio
          ref={audioRef}
          src={`/api/memories/${memoryId}/audio`}
          preload="none"
          onEnded={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          className="hidden"
        />
      ) : null}
    </>
  );
}
