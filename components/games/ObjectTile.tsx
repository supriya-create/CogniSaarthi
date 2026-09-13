"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type TileState = "idle" | "selected" | "correct" | "wrong" | "muted";

const STATES: Record<TileState, string> = {
  idle: "border-border bg-surface hover:border-border-strong hover:bg-surface-alt",
  selected: "border-primary bg-primary-soft",
  correct: "border-success bg-success-soft",
  wrong: "border-error bg-error-soft",
  muted: "border-border bg-surface-alt opacity-60",
};

/**
 * The single interactive unit shared by all three activities.
 *
 * Two rules it exists to enforce: every picture is paired with its
 * name in the person's own language, and every state is shown by a
 * mark as well as a colour — a tick for right, a cross for wrong —
 * so it still reads correctly to someone who cannot separate the
 * red from the green.
 */
export function ObjectTile({
  glyph,
  label,
  state = "idle",
  onClick,
  disabled,
  size = "md",
  showLabel = true,
}: {
  glyph: string;
  label: string;
  state?: TileState;
  onClick?: () => void;
  disabled?: boolean;
  size?: "lg" | "md";
  showLabel?: boolean;
}) {
  const interactive = Boolean(onClick) && !disabled;

  const body = (
    <>
      {state === "correct" || state === "wrong" ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-text-inverse",
            state === "correct" ? "bg-success" : "bg-error",
          )}
        >
          {state === "correct" ? (
            <Check className="size-5" strokeWidth={3} />
          ) : (
            <X className="size-5" strokeWidth={3} />
          )}
        </span>
      ) : null}

      {/* The glyph is sized with clamp rather than a plain rem step.
          Text-size preference multiplies every rem in the app, which
          on a phone would push a 16-tile grid wider than the screen.
          The vw term keeps the picture as large as the tile allows
          and no larger; the rem cap still honours the preference
          wherever there is room. */}
      <span
        aria-hidden
        className={cn(
          "leading-none",
          size === "lg"
            ? "text-[clamp(2.25rem,11vw,3.75rem)]"
            : "text-[clamp(1.5rem,7vw,3rem)]",
        )}
      >
        {glyph}
      </span>

      {showLabel ? (
        <span className="mt-2 text-center text-base leading-tight font-medium">
          {label}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex min-w-0 flex-col items-center justify-center rounded-2xl border-2 p-2 sm:p-3",
    "transition-[background-color,border-color,transform] duration-150 ease-gentle",
    // Labelled tiles need vertical room for the word; unlabelled
    // ones are pure targets and stay square, which keeps a dense
    // grid entirely on screen instead of running off the bottom.
    showLabel
      ? size === "lg"
        ? "min-h-[clamp(6.5rem,30vw,10rem)]"
        : "min-h-[clamp(4.5rem,20vw,7.5rem)]"
      : "aspect-square",
    STATES[state],
    interactive && "cursor-pointer active:scale-[0.98]",
    disabled && !interactive && "pointer-events-none",
  );

  if (!onClick) {
    return (
      <div className={className} aria-label={label} role="img">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      aria-label={label}
      className={className}
    >
      {body}
    </button>
  );
}
