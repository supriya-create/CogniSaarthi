"use client";

import { AlertCircle } from "lucide-react";
import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

type Props = {
  label: string;
  hint?: string;
  error?: string | null;
  size?: "lg" | "md";
} & Omit<ComponentPropsWithoutRef<"input">, "size">;

/**
 * A labelled input. The error is announced to screen readers and
 * carries an icon as well as red text, so the failure is never
 * communicated by colour alone.
 */
export function Field({
  label,
  hint,
  error,
  size = "lg",
  className,
  ...rest
}: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={cn(
          "block font-semibold text-text",
          size === "lg" ? "text-xl mb-2" : "text-base mb-1.5",
        )}
      >
        {label}
      </label>

      {hint ? (
        <p id={hintId} className="text-text-muted mb-3 text-base">
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          "w-full rounded-xl border-2 bg-surface text-text placeholder:text-text-muted/70",
          "transition-colors duration-150 ease-gentle",
          size === "lg" ? "px-5 py-4 text-2xl" : "px-4 py-2.5 text-base",
          error
            ? "border-error focus:border-error"
            : "border-border-strong focus:border-primary",
          className,
        )}
        {...rest}
      />

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-2 text-error text-base font-medium"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
