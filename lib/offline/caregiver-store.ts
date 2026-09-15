import * as db from "@/lib/offline/db";
import { META_KEYS, STORES } from "@/lib/offline/schema";
import {
  CAREGIVER_SNAPSHOT_VERSION,
  snapshotFreshness,
  type CaregiverSnapshot,
  type SnapshotFreshness,
} from "@/lib/caregiver/snapshot-types";

/**
 * CAREGIVER OFFLINE — the local store.
 * -----------------------------------------------------------------
 * Read-only from the product's point of view. Nothing a caregiver does
 * offline is queued for later: there are no caregiver entries in the
 * sync queue, and no function here creates one.
 *
 * That is a decision, not an omission. A reminder created offline and
 * pushed an hour later could fire in the past, or collide with an edit
 * the other caregiver made in the meantime — and unlike a game score,
 * there is no idempotency key that makes "create this reminder" safely
 * replayable. Until that is designed properly, offline caregiver is
 * read-only. See docs/caregiver-offline.md.
 */

/**
 * Store the snapshot the server just issued.
 *
 * `ensureCaregiverScope` runs first, so arriving as a different
 * caregiver on a shared device discards the previous one's snapshot
 * before this one is written — the caregiver equivalent of
 * `ensureUserScope`.
 */
export async function saveCaregiverSnapshot(
  snapshot: CaregiverSnapshot,
): Promise<void> {
  await ensureCaregiverScope(snapshot.caregiverId);
  await db.put(STORES.caregiverSnapshot, snapshot);
}

/**
 * Read this caregiver's snapshot.
 *
 * The caller passes the caregiver id it is authenticated as, and a
 * snapshot belonging to anyone else is ignored AND removed rather than
 * returned. A stale row for a previous account on a shared tablet is
 * not something to quietly skip over; it is something to get rid of.
 */
export async function getCaregiverSnapshot(
  caregiverId: string,
): Promise<CaregiverSnapshot | null> {
  const stored = await db.get<CaregiverSnapshot>(
    STORES.caregiverSnapshot,
    caregiverId,
  );
  if (!stored) return null;

  if (stored.caregiverId !== caregiverId) {
    await db.remove(STORES.caregiverSnapshot, stored.caregiverId);
    return null;
  }

  // A shape from an older build is not guessed at.
  if (stored.snapshotVersion !== CAREGIVER_SNAPSHOT_VERSION) return null;

  return stored;
}

export async function readSnapshotWithFreshness(
  caregiverId: string,
  now: Date = new Date(),
): Promise<{ snapshot: CaregiverSnapshot; freshness: SnapshotFreshness } | null> {
  const snapshot = await getCaregiverSnapshot(caregiverId);
  if (!snapshot) return null;
  return { snapshot, freshness: snapshotFreshness(snapshot, now) };
}

/**
 * Discard everything belonging to a DIFFERENT caregiver.
 *
 * An expired snapshot is NOT removed here. Keeping it lets the
 * interface say "this is what things looked like, and it is old",
 * which is more useful to a caregiver than an empty screen — as long
 * as the age is stated, which `stalenessMessage` guarantees.
 */
export async function ensureCaregiverScope(caregiverId: string): Promise<void> {
  const current = await db.getMeta<string>(META_KEYS.caregiverId);
  if (current && current !== caregiverId) {
    await db.clear(STORES.caregiverSnapshot);
  }
  await db.setMeta(META_KEYS.caregiverId, caregiverId);
}

/** Remove every caregiver snapshot on this device. Used on sign-out. */
export async function clearCaregiverSnapshots(): Promise<void> {
  await db.clear(STORES.caregiverSnapshot);
  await db.remove(STORES.meta, META_KEYS.caregiverId);
}

/**
 * Fetch a fresh snapshot and store it. Returns null when offline or
 * unauthorised — the caller falls back to whatever is already stored.
 *
 * Note the request carries no elder id: the server decides. The
 * response's `caregiverId` is checked against who we think we are, so a
 * response that somehow belonged to another account is discarded rather
 * than displayed.
 */
export async function refreshCaregiverSnapshot(
  caregiverId: string,
): Promise<CaregiverSnapshot | null> {
  try {
    const response = await fetch("/api/caregiver/snapshot", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;

    const snapshot = (await response.json()) as CaregiverSnapshot;
    if (snapshot?.caregiverId !== caregiverId) return null;
    if (snapshot.snapshotVersion !== CAREGIVER_SNAPSHOT_VERSION) return null;

    await saveCaregiverSnapshot(snapshot);
    return snapshot;
  } catch {
    // Offline, or the request was refused. Either way, keep what we have.
    return null;
  }
}
