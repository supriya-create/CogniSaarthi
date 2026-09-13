import type { LucideIcon } from "lucide-react";

/**
 * A single figure with a plain label. No sparklines, no percentage
 * change, no trend arrow — three days of data cannot support a
 * trend, and showing one would invite a family member to read
 * meaning into noise.
 */
export function SummaryTile({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="flex items-center gap-2 text-base font-medium text-text-muted">
        <Icon className="size-5 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-2 font-serif text-4xl font-semibold tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
