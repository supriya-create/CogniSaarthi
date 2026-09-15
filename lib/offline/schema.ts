/**
 * OFFLINE — IndexedDB schema.
 * -----------------------------------------------------------------
 * One database per origin, holding this device's local replica and the
 * work waiting to reach the server. Bumping DB_VERSION runs `upgrade`,
 * which only ever ADDS stores/indexes — a person's queued activity is
 * never dropped by a schema change.
 */

export const DB_NAME = "cognisaarthi";
/**
 * v2 (Phase 7) adds `caregiverSnapshot`.
 * v3 (Phase 8) adds `memoryRecalls`.
 * Both additive — see `upgrade`, which only ever creates what is
 * missing, so a device carrying queued answers keeps them across an
 * upgrade.
 */
export const DB_VERSION = 3;

export const STORES = {
  meta: "meta",
  profile: "profile",
  games: "games",
  sessions: "sessions",
  reminders: "reminders",
  reminderLogs: "reminderLogs",
  memories: "memories",
  queue: "queue",
  /**
   * Phase 7 — the caregiver's read-only snapshot, keyed by caregiver id.
   *
   * In the SAME database rather than a second one, deliberately: a
   * separate database would need its own open/upgrade/clear handling,
   * and — worse — its own sign-out path, which is exactly the kind of
   * thing that gets forgotten and leaves one person's data on a shared
   * tablet. One database means one `clearAll()`.
   *
   * It does not mix elder and caregiver data: this store is written only
   * from caregiver pages and is scoped by caregiver id, while every
   * other store is scoped by the elder in `meta.userId`.
   */
  caregiverSnapshot: "caregiverSnapshot",
  /**
   * Phase 8 — answers to personal-recall prompts given on this device.
   *
   * Scoped by the elder in `meta.userId` like every other elder store,
   * so it is cleared by the same `clearAll()` on sign-out and when a
   * different person signs in. It holds memory IDs and outcomes, never
   * a name or a description.
   */
  memoryRecalls: "memoryRecalls",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Keys used in the `meta` store. */
export const META_KEYS = {
  /** The elder this local database belongs to. */
  userId: "userId",
  /** When the last successful snapshot was pulled (ISO). */
  snapshotAt: "snapshotAt",
  /** Version of the cached server data, for atomic replacement. */
  contentVersion: "contentVersion",
  /** When the queue was last drained successfully (ISO). */
  lastSyncedAt: "lastSyncedAt",
  /** The caregiver whose snapshot is held on this device, if any. */
  caregiverId: "caregiverId",
} as const;

interface StoreSpec {
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

export const STORE_SPECS: Record<StoreName, StoreSpec> = {
  [STORES.meta]: { keyPath: "key" },
  [STORES.profile]: { keyPath: "id" },
  [STORES.games]: { keyPath: "id" },
  [STORES.sessions]: {
    keyPath: "clientSessionId",
    indexes: [
      { name: "by-sync", keyPath: "syncStatus" },
      { name: "by-created", keyPath: "createdAt" },
    ],
  },
  [STORES.reminders]: { keyPath: "id" },
  [STORES.reminderLogs]: {
    keyPath: "key",
    indexes: [{ name: "by-sync", keyPath: "syncStatus" }],
  },
  [STORES.memories]: { keyPath: "id" },
  [STORES.queue]: {
    keyPath: "id",
    indexes: [
      { name: "by-status", keyPath: "status" },
      { name: "by-created", keyPath: "createdAt" },
    ],
  },
  [STORES.caregiverSnapshot]: { keyPath: "caregiverId" },
  [STORES.memoryRecalls]: {
    keyPath: "clientEventId",
    indexes: [
      { name: "by-sync", keyPath: "syncStatus" },
      { name: "by-memory", keyPath: "memoryId" },
    ],
  },
};

/** Create anything missing. Additive only — never destructive. */
export function upgrade(db: IDBDatabase): void {
  for (const [name, spec] of Object.entries(STORE_SPECS)) {
    // An existing store keeps its data untouched.
    if (db.objectStoreNames.contains(name)) continue;
    const store = db.createObjectStore(name, { keyPath: spec.keyPath });
    for (const index of spec.indexes ?? []) {
      store.createIndex(index.name, index.keyPath, {
        unique: index.unique ?? false,
      });
    }
  }
}
