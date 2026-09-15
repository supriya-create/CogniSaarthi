import Link from "next/link";
import type { ReactNode } from "react";

import { CaregiverNav, CaregiverNavBar } from "@/components/caregiver/CaregiverNav";
import { Wordmark } from "@/components/ui/Logo";

/**
 * Layout for the caregiver side.
 *
 * A wider column, smaller type and denser information than the
 * elderly interface — this is a different person, on a different
 * device, with different needs. It shares the palette and the
 * typography so it still reads as the same product.
 *
 * From `lg` up the sections move into a rail down the left, which is
 * what makes this feel like a tool rather than a page; below that the
 * rail collapses into a scrollable row of pills, because a fixed
 * sidebar on a phone is just a column of wasted width.
 *
 * Phase 1 note: caregiver copy is English only. The elderly interface
 * is translated because that is where it matters most; translating
 * this side is queued rather than faked.
 */
export function CaregiverShell({
  children,
  action,
  nav,
  /** Shown under the wordmark in the rail, e.g. the elder's name. */
  subject,
}: {
  children: ReactNode;
  action?: ReactNode;
  /** Shows the section navigation. Off on sign-in and sign-up. */
  nav?: boolean;
  subject?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/caregiver" className="rounded-lg">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-3">{action}</div>
        </div>
        {nav ? <CaregiverNavBar /> : null}
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {nav ? (
          <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 lg:flex">
            <Link href="/caregiver" className="rounded-lg px-2">
              <Wordmark size="sm" />
            </Link>
            <p className="mt-1.5 px-2 text-sm font-semibold tracking-[0.1em] text-text-muted uppercase">
              Caregiver
            </p>
            {subject ? (
              <p className="mt-4 truncate rounded-xl border border-border bg-surface px-3 py-2.5 text-base font-semibold">
                {subject}
              </p>
            ) : null}

            <div className="mt-6 flex-1">
              <CaregiverNav />
            </div>

            <div className="mt-6 border-t border-border pt-5">{action}</div>
          </aside>
        ) : null}

        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-7 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
