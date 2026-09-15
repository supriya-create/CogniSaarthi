import Link from "next/link";
import type { ReactNode } from "react";
import type { Language } from "@prisma/client";

import { CaregiverNav, CaregiverNavBar } from "@/components/caregiver/CaregiverNav";
import { Wordmark } from "@/components/ui/Logo";
import { getCaregiverDict } from "@/lib/i18n/caregiver";

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
 * Phase 8: this side is translated too. The `language` comes from the
 * CAREGIVER's own preference, never from the elder they look after —
 * two different people who may read two different languages, and a
 * caregiver must not be able to change what the elderly person sees.
 */
export function CaregiverShell({
  children,
  action,
  nav,
  /** Shown under the wordmark in the rail, e.g. the elder's name. */
  subject,
  /** The caregiver's own reading language. Defaults to English so the
      sign-in and sign-up screens, which have no caregiver yet, still
      render without a special case. */
  language = "EN",
}: {
  children: ReactNode;
  action?: ReactNode;
  /** Shows the section navigation. Off on sign-in and sign-up. */
  nav?: boolean;
  subject?: string;
  language?: Language;
}) {
  const dict = getCaregiverDict(language);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl lg:hidden">
        {/* Wraps, because every size here is in rem: at the large
            text-size preference the wordmark and Sign out together
            exceed a 375px phone, and without this the button simply
            went off the right-hand edge. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5">
          <Link href="/caregiver" className="min-w-0 rounded-lg">
            <Wordmark size="sm" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">{action}</div>
        </div>
        {nav ? <CaregiverNavBar language={language} /> : null}
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {nav ? (
          <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 lg:flex">
            <Link href="/caregiver" className="rounded-lg px-2">
              <Wordmark size="sm" />
            </Link>
            <p className="mt-1.5 px-2 text-sm font-semibold tracking-[0.1em] text-text-muted uppercase">
              {dict.caregiverLabel}
            </p>
            {subject ? (
              <p className="mt-4 truncate rounded-xl border border-border bg-surface px-3 py-2.5 text-base font-semibold">
                {subject}
              </p>
            ) : null}

            <div className="mt-6 flex-1">
              <CaregiverNav language={language} />
            </div>

            <div className="mt-6 border-t border-border pt-5">{action}</div>
          </aside>
        ) : null}

        {/* `min-w-0` is load-bearing, not tidying. A flex item defaults
            to `min-width: auto`, so without it this column refuses to
            shrink below its own content: on a 1024px laptop the rail
            plus an un-shrinkable main pushed the page 307px wider than
            the window, and the whole dashboard scrolled sideways. */}
        <main
          id="main"
          className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-5 py-8 sm:px-7 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
