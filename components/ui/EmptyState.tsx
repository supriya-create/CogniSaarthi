import type { ReactNode } from "react";

import { LogoMark } from "@/components/ui/Logo";

/**
 * Shared empty state. Says what is missing in ordinary words and
 * offers the one action that would fill it — never a shrug.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center">
      <LogoMark className="mx-auto size-14 opacity-50" />
      <p className="mt-5 font-serif text-2xl font-semibold">{title}</p>
      {body ? (
        <p className="mx-auto mt-3 max-w-sm text-lg text-text-muted">{body}</p>
      ) : null}
      {action ? (
        <div className="mx-auto mt-7 max-w-xs">{action}</div>
      ) : null}
    </div>
  );
}
