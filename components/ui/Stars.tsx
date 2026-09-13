import { Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Five stars, always with a text equivalent for screen readers.
 * Empty stars keep their outline so the total is readable at a
 * glance rather than inferred from a gap.
 */
export function Stars({
  count,
  total = 5,
  label,
  ofLabel = "of",
  size = "lg",
}: {
  count: number;
  total?: number;
  label: string;
  /** The word joining the two numbers, e.g. "4 of 5". */
  ofLabel?: string;
  size?: "lg" | "sm";
}) {
  const dimension = size === "lg" ? "size-11" : "size-5";

  return (
    <div
      className={cn("flex items-center", size === "lg" ? "gap-2" : "gap-1")}
      role="img"
      aria-label={`${label}: ${count} ${ofLabel} ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < count;
        return (
          <Star
            key={i}
            aria-hidden
            className={cn(
              dimension,
              filled ? "fill-accent text-accent" : "fill-none text-border-strong",
            )}
            strokeWidth={filled ? 1.5 : 2}
          />
        );
      })}
    </div>
  );
}
