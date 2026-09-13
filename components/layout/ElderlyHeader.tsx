import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/ui/Logo";

/**
 * Top bar for the elderly interface.
 *
 * The back control is a wide target with the word "Back" beside the
 * arrow — an unlabelled chevron is the single most commonly
 * misunderstood control for this audience.
 */
export function ElderlyHeader({
  backHref,
  backLabel,
  title,
  action,
}: {
  backHref?: string;
  backLabel?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-2 inline-flex min-h-[3rem] items-center gap-1 rounded-xl px-3 py-2 text-lg font-semibold text-text transition-colors duration-150 hover:bg-surface-alt"
          >
            <ChevronLeft className="size-7 shrink-0" aria-hidden />
            <span>{backLabel}</span>
          </Link>
        ) : (
          <Link
            href="/home"
            className="-ml-1 rounded-xl px-1 py-1 transition-opacity hover:opacity-80"
          >
            <Wordmark />
          </Link>
        )}

        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-center font-serif text-xl font-semibold">
            {title}
          </h1>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center">{action}</div>
      </div>
    </header>
  );
}
