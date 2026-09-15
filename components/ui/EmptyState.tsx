import type { ReactNode } from "react";

import { LeafSprig } from "@/components/ui/Decor";
import { cn } from "@/lib/utils/cn";

/**
 * Shared empty state. Says what is missing in ordinary words and
 * offers the one action that would fill it — never a shrug, and
 * never anything that could be mistaken for an error.
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Replaces the default sprig when a page has a better-fitting mark. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-14 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-6 opacity-40"
      >
        <LeafSprig className="size-40 rotate-12" />
      </span>

      <div className="relative mx-auto flex max-w-sm flex-col items-center">
        <span
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full border border-border bg-surface-alt text-primary shadow-soft"
        >
          {icon ?? <LeafSprig className="size-12" />}
        </span>

        <p className="mt-6 font-serif text-2xl font-semibold">{title}</p>
        {body ? (
          <p className="mt-3 text-lg leading-relaxed text-text-muted">{body}</p>
        ) : null}
        {action ? <div className="mt-7 w-full max-w-xs">{action}</div> : null}
      </div>
    </div>
  );
}
