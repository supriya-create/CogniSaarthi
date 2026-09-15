import Link from "next/link";
import { ChevronLeft, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { ElderNavBar } from "@/components/layout/BottomNav";
import { Wordmark } from "@/components/ui/Logo";
import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * Top bar for the elderly interface.
 *
 * The back control is a wide target with the word "Back" beside the
 * arrow — an unlabelled chevron is the single most commonly
 * misunderstood control for this audience.
 *
 * On a tablet or laptop a second row appears with every destination
 * as a pill; on a phone that row is hidden and the bottom bar takes
 * over. Pass `dict` to switch the wide row on.
 */
export function ElderlyHeader({
  backHref,
  backLabel,
  title,
  action,
  dict,
}: {
  backHref?: string;
  backLabel?: string;
  title?: string;
  action?: ReactNode;
  /** Enables the wide navigation row. */
  dict?: Dict;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-2 inline-flex min-h-[3rem] items-center gap-1.5 rounded-full px-3.5 py-2 text-lg font-semibold text-text transition-colors duration-200 ease-gentle hover:bg-surface-alt"
          >
            <ChevronLeft className="size-6 shrink-0" aria-hidden />
            <span>{backLabel}</span>
          </Link>
        ) : (
          <Link
            href="/home"
            className="-ml-1 rounded-xl px-1 py-1 transition-opacity duration-200 hover:opacity-80"
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

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {/* The account control, in the place people look for it.
              On a phone this is a tab in the bottom bar instead. */}
          {dict ? (
            <Link
              href="/profile"
              className="hidden min-h-[2.75rem] items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-base font-semibold shadow-soft transition-colors duration-200 hover:bg-surface-alt md:inline-flex"
            >
              <UserRound className="size-5 shrink-0" aria-hidden />
              {dict.navProfile}
            </Link>
          ) : null}
        </div>
      </div>

      {dict ? <ElderNavBar dict={dict} /> : null}
    </header>
  );
}
