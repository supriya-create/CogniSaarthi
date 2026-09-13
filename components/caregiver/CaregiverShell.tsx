import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/ui/Logo";

/**
 * Layout for the caregiver side.
 *
 * A wider column, smaller type and denser information than the
 * elderly interface — this is a different person on a different
 * device with different needs. It shares the palette and the
 * typography so it still reads as the same product.
 *
 * Phase 1 note: caregiver copy is English only. The elderly
 * interface is translated because that is where it matters most;
 * translating this side is queued rather than faked.
 */
export function CaregiverShell({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/caregiver" className="rounded-lg">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border bg-surface-alt px-3 py-1 text-sm font-semibold text-text-muted sm:inline">
              Caregiver
            </span>
            {action}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
