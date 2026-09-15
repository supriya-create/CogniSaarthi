"use client";

import { CircleCheck, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The short "Correct" / "Not quite" note between rounds.
 *
 * Announced politely so a screen reader reads the outcome without
 * interrupting, and worded so a wrong answer never sounds like a
 * failure.
 */
export function RoundFeedback({
  correct,
  correctLabel,
  wrongLabel,
}: {
  correct: boolean;
  correctLabel: string;
  wrongLabel: string;
}) {
  const Icon = correct ? CircleCheck : CircleAlert;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "animate-pop inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-3 text-lg font-semibold shadow-lift",
        correct
          ? "border-success/30 bg-success-soft text-success"
          : "border-warning/30 bg-warning-soft text-warning",
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      {correct ? correctLabel : wrongLabel}
    </p>
  );
}
