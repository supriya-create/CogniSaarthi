"use client";

import { Mic, Square } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The floating voice control, shared by every screen that offers one.
 *
 * Three states, each said in words as well as shown:
 *   idle      — a plain microphone button
 *   listening — rings pulse outward and a caption says so
 *   speaking  — the button becomes Stop, so a long sentence can
 *               always be cut off
 *
 * It sits in the bottom-right corner above the navigation rather than
 * in the middle of the screen, because a control floating over the
 * middle of a page covers the thing the person was reading.
 *
 * The rings are decorative and vanish under reduced motion; the
 * caption and the label carry the state on their own.
 */
export function VoiceOrb({
  listening,
  speaking,
  caption,
  listenLabel,
  stopLabel,
  onActivate,
  onStop,
}: {
  listening: boolean;
  speaking: boolean;
  caption: string | null;
  listenLabel: string;
  stopLabel: string;
  onActivate: () => void;
  onStop: () => void;
}) {
  const active = listening || speaking;

  return (
    <div className="pointer-events-none fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2.5 sm:right-6 md:bottom-8">
      {caption ? (
        <p
          role="status"
          aria-live="polite"
          className="pointer-events-auto max-w-[16rem] animate-fade-up rounded-2xl border border-border bg-surface px-4 py-2.5 text-right text-base font-semibold shadow-float"
        >
          {caption}
        </p>
      ) : null}

      <div className="relative">
        {/* Two rings, offset in time, only while actually listening. */}
        {listening ? (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ripple"
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-ripple"
              style={{ animationDelay: "0.6s" }}
            />
          </>
        ) : null}

        <button
          type="button"
          onClick={speaking ? onStop : onActivate}
          aria-label={speaking ? stopLabel : listenLabel}
          aria-pressed={listening}
          className={cn(
            "pointer-events-auto relative flex size-16 cursor-pointer items-center justify-center rounded-full border-2",
            "shadow-float transition-[background-color,border-color,transform] duration-200 ease-out-soft",
            "hover:scale-105 active:scale-95",
            active
              ? "border-primary-strong bg-primary text-text-inverse"
              : "border-primary/40 bg-surface text-primary hover:bg-primary-soft",
          )}
        >
          {speaking ? (
            <Square className="size-7 fill-current" aria-hidden />
          ) : (
            <Mic
              className={cn(
                "size-8",
                listening && "motion-safe:animate-breathe",
              )}
              aria-hidden
            />
          )}
        </button>
      </div>
    </div>
  );
}
