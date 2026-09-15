import {
  DB_NAME,
  DB_VERSION,
  STORES,
  upgrade,
  type StoreName,
} from "@/lib/offline/schema";

/**
 * OFFLINE — a small promise wrapper over IndexedDB.
 * -----------------------------------------------------------------
 * Deliberately hand-written rather than pulling in a library: it is
 * about a hundred lines, and this codebase holds itself to a short
 * runtime dependency list. Everything else in lib/offline talks to
 * IndexedDB THROUGH this module, so raw request/transaction handling
 * exists in exactly one place.
 *
 * Every function degrades safely when IndexedDB is unavailable (server
 * rendering, private-mode restrictions, very old browsers): reads
 * resolve empty and writes resolve without throwing, so a device
 * without local storage still runs the app online.
 */

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let open: IDBOpenDBRequest;
    try {
      open = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    open.onupgradeneeded = () => upgrade(open.result);
    open.onsuccess = () => resolve(open.result);
    // A blocked or failed open must not take the app down with it.
    open.onerror = () => resolve(null);
    open.onblocked = () => resolve(null);
  });

  return dbPromise;
}

/** Test seam: forget the cached handle (used after deleteDatabase). */
export function resetDbHandle(): void {
  dbPromise = null;
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
  fallback: T,
): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;

  try {
    const tx = db.transaction(store, mode);
    const result = await run(tx.objectStore(store));
    // Let a write transaction settle before resolving.
    if (mode !== "readonly") {
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    }
    return result;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------
// Reads
// ---------------------------------------------------------------

export async function get<T>(
  store: StoreName,
  key: IDBValidKey,
): Promise<T | null> {
  return withStore<T | null>(
    store,
    "readonly",
    async (s) => ((await request(s.get(key))) as T) ?? null,
    null,
  );
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return withStore<T[]>(
    store,
    "readonly",
    async (s) => ((await request(s.getAll())) as T[]) ?? [],
    [],
  );
}

export async function getAllByIndex<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  return withStore<T[]>(
    store,
    "readonly",
    async (s) => ((await request(s.index(index).getAll(value))) as T[]) ?? [],
    [],
  );
}

export async function count(store: StoreName): Promise<number> {
  return withStore<number>(
    store,
    "readonly",
    async (s) => (await request(s.count())) ?? 0,
    0,
  );
}

// ---------------------------------------------------------------
// Writes
// ---------------------------------------------------------------

export async function put<T>(store: StoreName, value: T): Promise<void> {
  await withStore<void>(
    store,
    "readwrite",
    async (s) => {
      await request(s.put(value));
    },
    undefined,
  );
}

/** Replace a store's entire contents in ONE transaction, so a failed
 *  refresh can never leave half-updated data behind. */
export async function replaceAll<T>(
  store: StoreName,
  values: T[],
): Promise<void> {
  await withStore<void>(
    store,
    "readwrite",
    async (s) => {
      await request(s.clear());
      for (const value of values) {
        await request(s.put(value));
      }
    },
    undefined,
  );
}

export async function remove(
  store: StoreName,
  key: IDBValidKey,
): Promise<void> {
  await withStore<void>(
    store,
    "readwrite",
    async (s) => {
      await request(s.delete(key));
    },
    undefined,
  );
}

export async function clear(store: StoreName): Promise<void> {
  await withStore<void>(
    store,
    "readwrite",
    async (s) => {
      await request(s.clear());
    },
    undefined,
  );
}

// ---------------------------------------------------------------
// Meta helpers
// ---------------------------------------------------------------

export async function getMeta<T = string>(key: string): Promise<T | null> {
  const row = await get<{ key: string; value: T }>(STORES.meta, key);
  return row ? row.value : null;
}

export async function setMeta<T = string>(
  key: string,
  value: T,
): Promise<void> {
  await put(STORES.meta, { key, value });
}

/**
 * Wipe every local store. Used when a DIFFERENT elder signs in on this
 * device, and on sign-out, so one person's activity is never shown to
 * another on a shared family tablet.
 *
 * Since Phase 7 that includes `caregiverSnapshot`, so an elder switch
 * also discards any caregiver copy held here. That is broader than
 * strictly necessary — the snapshot belongs to a caregiver, not to the
 * outgoing elder — and it is kept that way on purpose: over-clearing on
 * a shared device costs one re-fetch, and under-clearing leaves a
 * readable copy of somebody's day behind.
 */
export async function clearAll(): Promise<void> {
  for (const store of Object.values(STORES)) {
    await clear(store);
  }
}
