"use client";

import { useEffect } from "react";

import * as caregiverStore from "@/lib/offline/caregiver-store";

/**
 * Keeps this device's caregiver snapshot current, and makes sure the
 * offline shell is cached so it can actually be opened later.
 *
 * Renders nothing. Mounted on the caregiver dashboard only, so a
 * snapshot is taken exactly when a caregiver has just looked at the
 * real thing — which is also the moment the copy is most useful and
 * least surprising.
 *
 * `caregiverId` comes from the server, from the session cookie. It is
 * used to scope the local store and to reject a response that somehow
 * belongs to another account; it is never sent up to ask for data.
 */
export function SnapshotSync({ caregiverId }: { caregiverId: string }) {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      await caregiverStore.refreshCaregiverSnapshot(caregiverId);
      if (cancelled) return;

      // Ask the worker to cache the DATA-FREE offline shell. Without
      // this the snapshot would be saved and then unreachable, because
      // /caregiver/offline would have no cached document to open.
      if (!("serviceWorker" in navigator)) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const worker = registration.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({
          type: "CACHE_SHELL",
          urls: performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(window.location.origin)),
          // NOT the dashboard we are standing on — that one is
          // per-user and the worker refuses it anyway.
          page: "/caregiver/offline",
          pages: ["/caregiver/offline"],
        });
      } catch {
        // No worker: the dashboard still works online.
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [caregiverId]);

  return null;
}
