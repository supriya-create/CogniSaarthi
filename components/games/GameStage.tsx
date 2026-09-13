"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { ProgressDots } from "@/components/elderly/ProgressDots";
import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * The frame around live play. Deliberately bare: no navigation bar,
 * no header links, nothing to wander off into mid-activity. The one
 * way out is an explicit "Stop activity".
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
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onQuit}
            className="-ml-2 inline-flex min-h-[3rem] items-center gap-2 rounded-xl px-3 py-2 text-base font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
          >
            <X className="size-6" aria-hidden />
            {dict.quitActivity}
          </button>

          {totalRounds > 1 ? (
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-text-muted">
                {dict.round} {round} / {totalRounds}
              </span>
              {/* The dots repeat what the line above already says, so
                  they are the first thing to go when space is tight
                  at a large text size on a phone. */}
              <span className="hidden sm:block">
                <ProgressDots
                  total={totalRounds}
                  filled={round}
                  label={dict.round}
                  ofLabel={dict.ofTotal}
                  size="sm"
                />
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-6 sm:px-6"
      >
        {children}
      </main>

      {footer ? (
        <footer className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
