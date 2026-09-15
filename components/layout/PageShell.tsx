import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Column layout shared by every elderly screen: a header, an optional
 * full-bleed hero, a single readable column of content, and optional
 * persistent navigation.
 *
 * Content is capped at a comfortable reading width and centred rather
 * than stretched across a tablet. The bottom padding clears the
 * floating voice control and the phone's home indicator.
 */
export function PageShell({
  header,
  hero,
  nav,
  children,
  className,
}: {
  header?: ReactNode;
  /** Full-bleed section rendered above the column, under the header. */
  hero?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      {hero}
      <main
        id="main"
        className={cn(
          "mx-auto w-full max-w-3xl flex-1 px-4 pt-7 pb-16 sm:px-6 sm:pt-9",
          className,
        )}
      >
        {children}
      </main>
      {nav}
    </div>
  );
}
