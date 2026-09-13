import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Column layout shared by every elderly screen: a header, a single
 * readable column of content, and optional persistent navigation.
 * Content is capped at a comfortable reading width and centred
 * rather than stretched across a tablet.
 */
export function PageShell({
  header,
  nav,
  children,
  className,
}: {
  header?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {header}
      <main
        id="main"
        className={cn(
          "mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10 sm:px-6",
          className,
        )}
      >
        {children}
      </main>
      {nav}
    </div>
  );
}
