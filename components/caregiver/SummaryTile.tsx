import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * A single figure with a plain label. No sparklines, no percentage
 * change, no trend arrow — three days of data cannot support a
 * trend, and showing one would invite a family member to read
 * meaning into noise.
 *
 * `tone` only tints the icon plate. It never changes the number, and
 * it is never the only thing saying what the number means.
 */
export function SummaryTile({
  label,
  value,
  hint,
  Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: LucideIcon;
  tone?: "primary" | "secondary" | "accent";
}) {
  const plates = {
    primary: "bg-primary-soft text-primary border-primary/15",
    secondary: "bg-secondary-soft text-secondary border-secondary/15",
    accent: "bg-accent-soft text-warning border-accent/25",
  } as const;

  return (
    <div className="panel panel-interactive flex items-start gap-4 p-5">
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl border",
          plates[tone],
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0">
        <p className="text-base font-medium text-text-muted">{label}</p>
        {/* These tiles carry two kinds of value: a figure ("1 / 3") and
            a phrase ("Not yet today", an activity name). A phrase set at
            the figure's size wraps to four cramped lines in a
            four-column row, so it steps down instead. */}
        <p
          className={cn(
            "numeric mt-1 font-serif leading-tight font-semibold",
            value.length > 12 ? "text-xl" : "text-3xl leading-none",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1.5 text-sm text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
