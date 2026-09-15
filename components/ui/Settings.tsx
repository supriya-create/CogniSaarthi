import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The settings vocabulary: a titled group, and rows inside it.
 *
 * One group per subject — who you are, how it reads, how it speaks —
 * so a long preferences page becomes five short ones stacked up.
 * Every row is a full-width target with a name, a sentence saying
 * what it does, and the control on the right.
 */
export function SettingsGroup({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden p-0", className)}>
      <header className="flex items-start gap-3.5 border-b border-border bg-surface-alt/50 px-5 py-4">
        {icon ? (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary-soft text-primary"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-base leading-snug text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/**
 * A row inside a group. `stacked` puts the control on its own line
 * below the label, which is what a segmented control or a list of
 * choices needs; the default puts it alongside.
 */
export function SettingsRow({
  label,
  description,
  control,
  stacked,
  className,
}: {
  label?: string;
  description?: string;
  control: ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  if (!label) {
    return <div className={cn("px-5 py-4", className)}>{control}</div>;
  }

  return (
    <div
      className={cn(
        "px-5 py-4",
        stacked
          ? ""
          : "flex flex-wrap items-center justify-between gap-x-5 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-lg leading-tight font-semibold">{label}</p>
        {description ? (
          <p className="mt-1 text-base leading-snug text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      <div className={cn(stacked ? "mt-3.5" : "shrink-0")}>{control}</div>
    </div>
  );
}
