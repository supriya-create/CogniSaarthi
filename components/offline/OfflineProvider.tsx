"use client";

import { useEffect } from "react";
import type { Language } from "@prisma/client";

import { OfflineStatus } from "@/components/offline/OfflineStatus";
import { GAME_DEFINITIONS } from "@/lib/game-engine/definitions";
import { connectivity } from "@/lib/offline/connectivity";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import { syncNow } from "@/lib/offline/sync";
import { offlineStatus } from "@/lib/offline/useOffline";

/**
 * Wires the offline layer into the running app, once, at the root.
 *
 * On arrival it scopes the local database to the signed-in elder (a
 * shared family tablet must never show one person another's activity),
 * pushes anything that was queued while offline, and pulls a fresh
 * snapshot. When the network returns it does the same again.
 *
 * The service worker is registered here too, so the app shell is
 * available on a later visit with no connection.
 *
 * Nothing here blocks rendering: every call is fire-and-forget, and no
 * state is set from an effect.
 */
/**
 * The elder routes kept available offline.
 *
 * The four activity routes are included by name: they are dynamic in
 * the router, but the set of games is fixed and known here, and without
 * them "start an activity" offline would land on the fallback page.
 *
 * `/results/[id]` is deliberately absent — since Phase 5 the result is
 * rendered in place when an activity finishes, so nothing navigates
 * there offline.
 */
const OFFLINE_ROUTES = [
  "/home",
  "/games",
  "/reminders",
  "/routine",
  "/memories",
  // Memory Lane. Named explicitly even though the worker's rule
  // already allows anything under /memories: this list is what gets
  // FETCHED and stored ahead of time, and without the entry the page
  // would only be available offline to somebody who had happened to
  // open it while online.
  "/memories/lane",
  "/memories/remember",
  "/history",
  "/profile",
  "/help",
  ...GAME_DEFINITIONS.map((game) => `/games/${game.id}`),
];

export function OfflineProvider({
  userId,
  language,
}: {
  /** Null for caregiver pages and signed-out visitors. */
  userId: string | null;
  language: Language;
}) {
  useEffect(() => {
    // Register the shell cache regardless of who is signed in; the
    // worker itself never caches caregiver pages or any API response.
    if (!("serviceWorker" in navigator)) return;

    async function registerAndCacheShell() {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;

        // Next.js hashes its chunk filenames at build time, so the
        // worker cannot know them. Tell it what this page actually
        // loaded; it re-checks every URL against its own allowlist
        // before storing anything.
        const assets = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(window.location.origin));

        const worker = registration.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({
          type: "CACHE_SHELL",
          urls: assets,
          page: window.location.pathname,
          // Every elder route, so pressing Home (or any nav) offline
          // lands on a real cached page instead of the fallback. Only
          // sent once an elder is signed in — otherwise these would
          // redirect to onboarding and cache the wrong thing.
          pages: userId ? OFFLINE_ROUTES : undefined,
        });
      } catch {
        // A browser that refuses the worker still runs the app online.
      }
    }

    // Wait for load so `performance` has the full resource list.
    if (document.readyState === "complete") {
      void registerAndCacheShell();
    } else {
      window.addEventListener("load", () => void registerAndCacheShell(), {
        once: true,
      });
    }
    // Re-runs once the elder is known, which is when the page list can
    // safely be cached. Registering twice is a no-op.
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function bootstrap() {
      await repo.ensureUserScope(userId!);
      if (cancelled) return;
      await syncNow();
      if (cancelled) return;
      await offlineStatus.refresh();
    }

    void bootstrap();

    // Coming back online is the moment to catch up.
    function onOnline() {
      void connectivity.checkHealth(true).then(async (reachable) => {
        if (!reachable) return;
        // Clear the backoff first. Work that failed repeatedly while
        // the connection was down may have backed off to ten minutes,
        // and waiting that out with a working connection looks to the
        // person like the app losing what they did.
        await queue.resetBackoff();
        await syncNow();
      });
    }

    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [userId]);

  // Only the elder interface gets the status bar; the caregiver side
  // shows its own "last updated" wording instead.
  if (!userId) return null;
  return <OfflineStatus language={language} />;
}
