"use client";

import { useSyncExternalStore } from "react";
import type { ReminderLogStatus } from "@prisma/client";

import { connectivity } from "@/lib/offline/connectivity";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import type {
  CachedMemory,
  ConnectionState,
  LocalGameSession,
  LocalMemoryRecall,
} from "@/lib/offline/types";

/**
 * React glue for the offline layer.
 *
 * Both hooks read from EXTERNAL stores via useSyncExternalStore rather
 * than loading data in an effect and calling setState. That is not a
 * stylistic choice: React Compiler is enabled here and
 * `react-hooks/set-state-in-effect` is an error, and this shape is also
 * simply correct — the server snapshot renders as "online, nothing
 * pending", and the client reconciles after hydration without a flash.
 */

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    connectivity.subscribe,
    connectivity.getSnapshot,
    connectivity.getServerSnapshot,
  );
}

export interface OfflineStatusState {
  /** Activities and answers still waiting to reach the server. */
  pending: number;
  lastSyncedAt: string | null;
}

const SERVER_STATE: OfflineStatusState = { pending: 0, lastSyncedAt: null };

class OfflineStatusStore {
  private listeners = new Set<() => void>();
  private wiredToConnectivity = false;
  // Cached so getSnapshot returns a stable reference between changes.
  private state: OfflineStatusState = { pending: 0, lastSyncedAt: null };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    // Re-read whenever connectivity changes (a sync just ran, or the
    // network came back). No polling.
    if (!this.wiredToConnectivity) {
      this.wiredToConnectivity = true;
      connectivity.subscribe(() => void this.refresh());
    }
    void this.refresh();

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): OfflineStatusState => this.state;
  getServerSnapshot = (): OfflineStatusState => SERVER_STATE;

  /** Re-read counts from IndexedDB and notify only on real change. */
  refresh = async (): Promise<void> => {
    const [pending, last] = await Promise.all([
      queue.countPending(),
      repo.lastSyncedAt(),
    ]);
    const lastSyncedAt = last ? last.toISOString() : null;

    if (pending === this.state.pending && lastSyncedAt === this.state.lastSyncedAt) {
      return;
    }
    this.state = { pending, lastSyncedAt };
    for (const listener of this.listeners) listener();
  };
}

export const offlineStatus = new OfflineStatusStore();

export function useOfflineStatus(): OfflineStatusState & {
  connection: ConnectionState;
} {
  const connection = useConnection();
  const state = useSyncExternalStore(
    offlineStatus.subscribe,
    offlineStatus.getSnapshot,
    offlineStatus.getServerSnapshot,
  );
  return { connection, ...state };
}

// ---------------------------------------------------------------
// Locally answered reminders
// ---------------------------------------------------------------

export interface ReminderOverride {
  status: ReminderLogStatus;
  snoozedUntil: string | null;
}

export type ReminderOverrides = Record<string, ReminderOverride>;

const NO_OVERRIDES: ReminderOverrides = {};

/**
 * Answers given on THIS device, keyed by occurrence.
 *
 * The reminders screen is server-rendered, so when it is opened from
 * the offline cache its HTML shows the state as of the last visit.
 * Laying these overrides on top means a reminder the person just
 * answered still reads as answered — with or without a connection.
 */
class ReminderOverrideStore {
  private listeners = new Set<() => void>();
  private state: ReminderOverrides = NO_OVERRIDES;
  private serialised = "{}";

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.refresh();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ReminderOverrides => this.state;
  getServerSnapshot = (): ReminderOverrides => NO_OVERRIDES;

  refresh = async (): Promise<void> => {
    const logs = await repo.allReminderLogs();
    const next: ReminderOverrides = {};
    for (const log of logs) {
      next[log.key] = {
        status: log.status,
        snoozedUntil: log.snoozedUntil,
      };
    }

    const serialised = JSON.stringify(next);
    if (serialised === this.serialised) return;
    this.serialised = serialised;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
}

export const reminderOverrides = new ReminderOverrideStore();

export function useReminderOverrides(): ReminderOverrides {
  return useSyncExternalStore(
    reminderOverrides.subscribe,
    reminderOverrides.getSnapshot,
    reminderOverrides.getServerSnapshot,
  );
}

// ---------------------------------------------------------------
// Activities saved here but not yet on the server
// ---------------------------------------------------------------

const NO_SESSIONS: LocalGameSession[] = [];

/**
 * Local sessions the server has not confirmed yet. The history screen
 * shows these alongside the server's own list; because a session leaves
 * this set the moment it syncs, the two lists can never show the same
 * activity twice.
 */
class UnsyncedSessionStore {
  private listeners = new Set<() => void>();
  private state: LocalGameSession[] = NO_SESSIONS;
  private serialised = "[]";

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.refresh();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LocalGameSession[] => this.state;
  getServerSnapshot = (): LocalGameSession[] => NO_SESSIONS;

  refresh = async (): Promise<void> => {
    const all = await repo.allLocalSessions();
    const next = all.filter(
      (s) => s.syncStatus !== "SYNCED" && s.status === "COMPLETED",
    );
    const serialised = JSON.stringify(
      next.map((s) => [s.clientSessionId, s.syncStatus, s.score]),
    );
    if (serialised === this.serialised) return;
    this.serialised = serialised;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
}

export const unsyncedSessions = new UnsyncedSessionStore();

export function useUnsyncedSessions(): LocalGameSession[] {
  return useSyncExternalStore(
    unsyncedSessions.subscribe,
    unsyncedSessions.getSnapshot,
    unsyncedSessions.getServerSnapshot,
  );
}

// ---------------------------------------------------------------
// Memory Lane — the local replica the schedule is derived from
// ---------------------------------------------------------------

const NO_RECALLS: LocalMemoryRecall[] = [];
const NO_MEMORIES: CachedMemory[] = [];

/**
 * Every recall answer this device knows about.
 *
 * That is the answers given HERE and not yet pushed, plus the ones the
 * last snapshot brought down from the server — `applySnapshot` merges
 * both into one store keyed by `clientEventId`, so this list is already
 * de-duplicated and needs no reconciliation by the caller.
 *
 * Memory Lane derives its whole schedule from this. Deriving it from
 * the server render instead would mean a sitting played offline this
 * morning was invisible to the sitting played offline this afternoon,
 * and the same photographs would come round again as though nothing
 * had happened.
 */
class MemoryRecallStore {
  private listeners = new Set<() => void>();
  private state: LocalMemoryRecall[] = NO_RECALLS;
  private serialised = "[]";

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.refresh();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LocalMemoryRecall[] => this.state;
  getServerSnapshot = (): LocalMemoryRecall[] => NO_RECALLS;

  refresh = async (): Promise<void> => {
    const all = await repo.allMemoryRecalls();
    const serialised = JSON.stringify(
      all.map((e) => [e.clientEventId, e.outcome, e.occurredAt]),
    );
    if (serialised === this.serialised) return;
    this.serialised = serialised;
    this.state = all;
    for (const listener of this.listeners) listener();
  };
}

export const memoryRecalls = new MemoryRecallStore();

export function useLocalRecalls(): LocalMemoryRecall[] {
  return useSyncExternalStore(
    memoryRecalls.subscribe,
    memoryRecalls.getSnapshot,
    memoryRecalls.getServerSnapshot,
  );
}

/**
 * The memory metadata held on this device.
 *
 * Preferred over the server render when it is populated, because the
 * page HTML may have come out of the offline cache and be days old —
 * a memory a caregiver disabled yesterday should not reappear because
 * of a stale document.
 */
class MemoryCacheStore {
  private listeners = new Set<() => void>();
  private state: CachedMemory[] = NO_MEMORIES;
  private serialised = "[]";

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    void this.refresh();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CachedMemory[] => this.state;
  getServerSnapshot = (): CachedMemory[] => NO_MEMORIES;

  refresh = async (): Promise<void> => {
    const all = await repo.getMemories();
    const serialised = JSON.stringify(
      all.map((m) => [m.id, m.title, m.hasImage, m.hasAudio]),
    );
    if (serialised === this.serialised) return;
    this.serialised = serialised;
    this.state = all;
    for (const listener of this.listeners) listener();
  };
}

export const cachedMemories = new MemoryCacheStore();

export function useCachedMemories(): CachedMemory[] {
  return useSyncExternalStore(
    cachedMemories.subscribe,
    cachedMemories.getSnapshot,
    cachedMemories.getServerSnapshot,
  );
}
