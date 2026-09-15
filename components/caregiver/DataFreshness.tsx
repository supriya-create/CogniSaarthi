"use client";

import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";

import { useConnection } from "@/lib/offline/useOffline";

/**
 * Tells the caregiver how current what they are looking at actually is.
 *
 * The caregiver DASHBOARD is still never stored in the offline cache —
 * this is a shared family tablet, and a cached dashboard could be shown
 * to someone without a caregiver sign-in. What Phase 7 added is a
 * separate, data-free shell at /caregiver/offline that reads a
 * per-caregiver snapshot from IndexedDB, so losing the connection no
 * longer means losing the information entirely.
 *
 * While the connection is down, the figures ON THIS PAGE are a moment
 * in time rather than live, and this says so plainly rather than
 * leaving them looking current.
 *
 * `label` is formatted on the server so the text is identical on both
 * renders — no hydration mismatch, and no clock-drift guessing.
 */
export function DataFreshness({ label }: { label: string }) {
  const connection = useConnection();
  const offline = connection === "OFFLINE";

  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${
        offline
          ? "border-warning/40 bg-warning-soft text-warning"
          : "border-border bg-surface text-text-muted"
      }`}
    >
      {offline ? (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden />
          You&apos;re offline. Showing the information from {label}.
          <Link
            href="/caregiver/offline"
            className="font-semibold underline underline-offset-2"
          >
            Open the saved view
          </Link>
        </>
      ) : (
        <>
          <RefreshCw className="size-4 shrink-0" aria-hidden />
          Updated {label}
        </>
      )}
    </p>
  );
}
