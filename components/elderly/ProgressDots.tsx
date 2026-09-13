import { cn } from "@/lib/utils/cn";

/**
 * Progress as a small row of filled and hollow dots. Hollow dots
 * keep an outline so "three of five" is countable, and the whole
 * row carries a text label for screen readers.
 */
export function ProgressDots({
  total,
  filled,
  label,
  ofLabel = "of",
  size = "md",
}: {
  total: number;
  filled: number;
  label: string;
  /** The word joining the two numbers, e.g. "3 of 5". */
  ofLabel?: string;
  size?: "md" | "sm";
}) {
  const dot = size === "md" ? "size-4" : "size-3";

  return (
    <div
      className="flex items-center gap-2.5"
      role="img"
      aria-label={`${label}: ${filled} ${ofLabel} ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            dot,
            "rounded-full border-2 transition-colors duration-200 ease-gentle",
            i < filled
              ? "border-primary bg-primary"
              : "border-border-strong bg-transparent",
          )}
        />
      ))}
    </div>
  );
}
