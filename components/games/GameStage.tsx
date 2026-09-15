"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * The frame around live play. Deliberately bare: no navigation bar,
 * no header links, nothing to wander off into mid-activity. The one
 * way out is an explicit "Stop activity".
 *
 * Progress is a filling bar with the round written beside it. A bar
 * on its own is a decoration; the words are what tell someone how
 * much is left.
 */
export function GameStage({
  dict,
  round,
  totalRounds,
  onQuit,
  children,
  footer,
}: {
  dict: Dict;
  round: number;
  totalRounds: number;
  onQuit: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const percent =
    totalRounds > 0 ? Math.min(100, (round / totalRounds) * 100) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onQuit}
            className="-ml-2 inline-flex min-h-[3rem] cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-base font-semibold text-text-muted transition-colors duration-200 hover:bg-surface-alt hover:text-text"
          >
            <X className="size-6" aria-hidden />
            {dict.quitActivity}
          </button>

          {totalRounds > 1 ? (
            <span className="numeric rounded-full border border-border bg-surface px-3.5 py-1.5 text-base font-semibold text-text-muted">
              {dict.round} {round} / {totalRounds}
            </span>
          ) : null}
        </div>

        {totalRounds > 1 ? (
          <div
            className="h-1.5 w-full bg-surface-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalRounds}
            aria-valuenow={round}
            aria-label={dict.round}
          >
            <div
              className="h-full rounded-r-full bg-primary transition-[width] duration-500 ease-out-soft"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-7 pb-6 sm:px-6"
      >
        {children}
      </main>

      {footer ? (
        <footer className="sticky bottom-0 border-t border-border/80 bg-bg/90 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
