import * as db from "@/lib/offline/db";
import { STORES } from "@/lib/offline/schema";
import { newId, toStorablePayload } from "@/lib/offline/serialization";
import type {
  SyncEntityType,
  SyncOperation,
  SyncOperationKind,
  SyncOperationStatus,
} from "@/lib/offline/types";

/**
 * OFFLINE — the durable sync queue.
 * -----------------------------------------------------------------
 * Work waiting to reach the server, kept in IndexedDB so it survives a
 * refresh, a closed tab, or a battery-flat tablet. The scheduling rules
 * at the top are pure functions, so retry behaviour is unit-tested
 * without a browser.
 *
 * The contract that matters: user data is NEVER silently discarded. An
 * operation that cannot succeed is parked as FAILED (or NEEDS_AUTH) and
 * kept for inspection and recovery — it is not deleted.
 */

/** Give up retrying automatically after this many attempts. */
export const MAX_ATTEMPTS = 6;

/**
 * Bounded exponential backoff. The first retry is immediate (a blip
 * usually clears at once); later ones back off so a tablet on a bad
 * connection is not hammering the network or the battery.
 */
const BACKOFF_MS = [0, 2_000, 10_000, 30_000, 120_000, 600_000];

export function backoffDelayMs(attempts: number): number {
  if (attempts <= 0) return BACKOFF_MS[0];
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

/** Whether a failure is worth trying again (a blip, not a rejection). */
export function isRetryableError(errorCode: string | null | undefined): boolean {
  if (!errorCode) return true; // unknown/network failure
  return [
    "network",
    "timeout",
    "server_error",
    "rate_limited",
    "unavailable",
  ].includes(errorCode);
}

/** Where an operation lands after an attempt fails. */
export function statusAfterFailure(
  attempts: number,
  errorCode: string | null,
): SyncOperationStatus {
  if (errorCode === "unauthenticated") return "NEEDS_AUTH";
  if (!isRetryableError(errorCode)) return "FAILED";
  return attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
}

/** True when a pending operation's backoff has elapsed. */
export function isDueForRetry(
  operation: Pick<SyncOperation, "attempts" | "lastAttemptAt" | "status">,
  now: Date = new Date(),
): boolean {
  if (operation.status !== "PENDING") return false;
  if (!operation.lastAttemptAt) return true;
  const last = new Date(operation.lastAttemptAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= backoffDelayMs(operation.attempts);
}

// ---------------------------------------------------------------
// Store access
// ---------------------------------------------------------------

export async function enqueue(input: {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationKind;
  payload: unknown;
}): Promise<SyncOperation> {
  const operation: SyncOperation = {
    id: newId(),
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    // Only plain data reaches the queue — never functions or instances.
    payload: toStorablePayload(input.payload),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    status: "PENDING",
    errorCode: null,
  };

  // One queued operation per entity+kind: re-answering a reminder
  // replaces the earlier queued answer rather than stacking up.
  const existing = await findQueued(input.entityType, input.entityId, input.operation);
  if (existing) {
    const replacement = { ...operation, id: existing.id, createdAt: existing.createdAt };
    await db.put(STORES.queue, replacement);
    return replacement;
  }

  await db.put(STORES.queue, operation);
  return operation;
}

async function findQueued(
  entityType: SyncEntityType,
  entityId: string,
  operation: SyncOperationKind,
): Promise<SyncOperation | null> {
  const all = await db.getAll<SyncOperation>(STORES.queue);
  return (
    all.find(
      (o) =>
        o.entityType === entityType &&
        o.entityId === entityId &&
        o.operation === operation &&
        (o.status === "PENDING" || o.status === "IN_FLIGHT"),
    ) ?? null
  );
}

export async function allOperations(): Promise<SyncOperation[]> {
  return db.getAll<SyncOperation>(STORES.queue);
}

/** Pending operations whose backoff has elapsed, oldest first. */
export async function dueOperations(
  now: Date = new Date(),
  limit = 50,
): Promise<SyncOperation[]> {
  const all = await db.getAll<SyncOperation>(STORES.queue);
  return all
    .filter((o) => isDueForRetry(o, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

export async function countPending(): Promise<number> {
  const all = await db.getAll<SyncOperation>(STORES.queue);
  return all.filter((o) => o.status === "PENDING" || o.status === "IN_FLIGHT")
    .length;
}

export async function failedOperations(): Promise<SyncOperation[]> {
  const all = await db.getAll<SyncOperation>(STORES.queue);
  return all.filter((o) => o.status === "FAILED" || o.status === "NEEDS_AUTH");
}

export async function markInFlight(
  ids: string[],
  now: Date = new Date(),
): Promise<void> {
  for (const id of ids) {
    const operation = await db.get<SyncOperation>(STORES.queue, id);
    if (!operation) continue;
    await db.put(STORES.queue, {
      ...operation,
      status: "IN_FLIGHT",
      attempts: operation.attempts + 1,
      lastAttemptAt: now.toISOString(),
    } satisfies SyncOperation);
  }
}

/** A completed operation is removed — its effect now lives on the
 *  server, so keeping it would only re-send the same change. */
export async function markDone(id: string): Promise<void> {
  await db.remove(STORES.queue, id);
}

export async function markFailure(
  id: string,
  errorCode: string | null,
): Promise<SyncOperationStatus> {
  const operation = await db.get<SyncOperation>(STORES.queue, id);
  if (!operation) return "FAILED";

  const status = statusAfterFailure(operation.attempts, errorCode);
  await db.put(STORES.queue, {
    ...operation,
    status,
    errorCode,
  } satisfies SyncOperation);
  return status;
}

/** Put NEEDS_AUTH work back in line once the person has signed in. */
export async function retryAuthBlocked(): Promise<number> {
  const all = await db.getAll<SyncOperation>(STORES.queue);
  const blocked = all.filter((o) => o.status === "NEEDS_AUTH");
  for (const operation of blocked) {
    await db.put(STORES.queue, {
      ...operation,
      status: "PENDING",
      attempts: 0,
      lastAttemptAt: null,
      errorCode: null,
    } satisfies SyncOperation);
  }
  return blocked.length;
}
