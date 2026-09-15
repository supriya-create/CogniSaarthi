"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * An on/off control.
 *
 * It is a real `<input type="checkbox">` underneath — the visible
 * track is drawn from it with `peer-checked`, so keyboard, screen
 * reader and form semantics are the browser's rather than ours.
 *
 * The knob carries a tick when on and a cross when off. A switch
 * whose only difference between states is which side the knob sits on
 * is a coin-flip for someone who cannot see the colour change, and
 * this audience is exactly the one that catches it.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[3.5rem] cursor-pointer items-center justify-between gap-5 py-1",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <span className="min-w-0">
        <span className="block text-lg leading-tight font-semibold">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-base leading-snug text-text-muted">
            {description}
          </span>
        ) : null}
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />

      <span
        aria-hidden
        className={cn(
          "relative flex h-9 w-16 shrink-0 items-center rounded-full border-2 p-0.5",
          "transition-colors duration-200 ease-gentle",
          "border-border-strong bg-surface-sunken",
          "peer-checked:border-primary peer-checked:bg-primary",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-focus",
        )}
      >
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full bg-surface shadow-soft",
            "transition-transform duration-200 ease-out-soft",
            checked ? "translate-x-7" : "translate-x-0",
          )}
        >
          {checked ? (
            <Check className="size-4 text-primary" strokeWidth={3.2} />
          ) : (
            <X className="size-4 text-text-muted" strokeWidth={3.2} />
          )}
        </span>
      </span>
    </label>
  );
}
