"use client";

import { CloudOff, Check, RefreshCw } from "lucide-react";
import type { Language } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";
import { useOfflineStatus } from "@/lib/offline/useOffline";
import { cn } from "@/lib/utils/cn";

/**
 * The one thing the elder is told about connectivity.
 *
 * Calm and reassuring, never technical: no "queue", "sync", "API" or
 * "conflict". It appears only when there is something worth saying —
 * when the connection is gone, or while activities are being saved —
 * and stays out of the way the rest of the time.
 *
 * It floats at the top as a pill rather than pushing the page down as
 * a banner. A banner that appears and disappears reflows everything
 * underneath it, which on a patchy connection means the button
 * someone was reaching for moves as they reach for it.
 *
 * Accessibility: the message is carried by an icon AND words (never
 * colour alone), announced politely to screen readers, and sized for
 * the elder text scale like everything else.
 */
export function OfflineStatus({ language }: { language: Language }) {
  const dict = getDict(language);
  const { connection, pending } = useOfflineStatus();

  const offline = connection === "OFFLINE";
  const saving = connection === "SYNCING" || (!offline && pending > 0);

  // Nothing to say when connected with nothing waiting.
  if (!offline && !saving) return null;

  const message = offline ? dict.connOffline : dict.connSyncing;
  const Icon = offline ? CloudOff : RefreshCw;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
    >
      <p
        className={cn(
          "animate-fade-up flex max-w-[34rem] items-center gap-2.5 rounded-full border px-4 py-2.5 text-base font-semibold shadow-float backdrop-blur-xl",
          offline
            ? "border-warning/40 bg-warning-soft/95 text-warning"
            : "border-border bg-surface/95 text-text-muted",
        )}
      >
        <Icon
          className={cn(
            "size-5 shrink-0",
            !offline && "motion-safe:animate-spin",
          )}
          aria-hidden
        />
        <span className="text-balance">{message}</span>
      </p>
    </div>
  );
}

/**
 * A small "saved on this device" note for an individual item that has
 * not reached the server yet. Used sparingly — the elder should not
 * have to think about where their activity lives.
 */
export function SavedLocallyBadge({ language }: { language: Language }) {
  const dict = getDict(language);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3.5 py-1.5 text-sm font-medium text-text-muted">
      <Check className="size-4 shrink-0 text-success" aria-hidden />
      {dict.offlineSavedOnDevice}
    </span>
  );
}
