import { cn } from "@/lib/utils/cn";

/**
 * The day's progress as a filling ring.
 *
 * It counts activities, never performance — a full ring means "you
 * did what you set out to do today", not "you scored well". The
 * number inside is the same count written out, and the whole thing
 * carries a sentence for screen readers, so nothing here depends on
 * being able to judge an arc by eye.
 */
export function ProgressRing({
  completed,
  goal,
  label,
  ofLabel = "of",
  size = "md",
  className,
}: {
  completed: number;
  goal: number;
  label: string;
  ofLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const safeGoal = Math.max(goal, 1);
  const done = Math.min(Math.max(completed, 0), safeGoal);
  const fraction = done / safeGoal;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const complete = done >= safeGoal;

  return (
    <div
      className={cn(
        "relative shrink-0",
        size === "md" ? "size-24" : "size-16",
        className,
      )}
      role="img"
      aria-label={`${label}: ${done} ${ofLabel} ${safeGoal}`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--c-border)"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={complete ? "var(--c-success)" : "var(--c-primary)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-700 ease-out-soft"
        />
      </svg>

      <span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
      >
        <span
          className={cn(
            "numeric font-serif font-semibold",
            size === "md" ? "text-2xl" : "text-lg",
          )}
        >
          {done}
        </span>
        <span
          className={cn(
            "numeric mt-0.5 font-medium text-text-muted",
            size === "md" ? "text-sm" : "text-xs",
          )}
        >
          {ofLabel} {safeGoal}
        </span>
      </span>
    </div>
  );
}
