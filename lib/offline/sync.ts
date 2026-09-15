import { connectivity } from "@/lib/offline/connectivity";
import * as queue from "@/lib/offline/queue";
import * as repo from "@/lib/offline/repositories";
import type {
  OfflineSnapshot,
  SyncOperation,
  SyncOperationResult,
  SyncPushResponse,
  SyncRunSummary,
} from "@/lib/offline/types";

/**
 * OFFLINE — the synchronisation engine.
 * -----------------------------------------------------------------
 * Push first (the person's own activity matters most), then pull a
 * fresh snapshot. Runs opportunistically: on load, when the network
 * returns, and after an activity finishes. Never on a timer loop.
 *
 * Guarantees:
 *  - one run at a time (a second call while running is a no-op);
 *  - the server re-validates and re-scores everything;
 *  - a failure is recorded against the operation, never dropped;
 *  - nothing here blocks the interface — callers fire and forget.
 */

/** Map a transport-level failure to a queue error code. */
export function classifyHttpFailure(status: number): {
  errorCode: string;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { errorCode: "unauthenticated", retryable: false };
  }
  if (status === 429) return { errorCode: "rate_limited", retryable: true };
  if (status >= 500) return { errorCode: "server_error", retryable: true };
  return { errorCode: "invalid", retryable: false };
}

let running = false;

/** Push queued work. Returns what happened, for the status UI. */
export async function pushPending(
  now: Date = new Date(),
): Promise<SyncRunSummary> {
  const empty: SyncRunSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    needsAuth: false,
  };

  const due = await queue.dueOperations(now);
  if (due.length === 0) return empty;

  await queue.markInFlight(due.map((o) => o.id), now);

  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ operations: due.map(toWireOperation) }),
    });
  } catch {
    // The network went away mid-flight. Everything stays queued.
    connectivity.reportReachable(false);
    for (const operation of due) {
      await queue.markFailure(operation.id, "network");
    }
    return { ...empty, attempted: due.length, failed: due.length };
  }

  if (!response.ok) {
    const { errorCode } = classifyHttpFailure(response.status);
    let needsAuth = false;
    for (const operation of due) {
      const status = await queue.markFailure(operation.id, errorCode);
      if (status === "NEEDS_AUTH") needsAuth = true;
    }
    return { ...empty, attempted: due.length, failed: due.length, needsAuth };
  }

  connectivity.reportReachable(true);

  const body = (await response.json().catch(() => null)) as SyncPushResponse | null;
  const results = body?.results ?? [];
  return applyResults(due, results);
}

/** The shape the server expects — plain, validated data only. */
function toWireOperation(operation: SyncOperation) {
  return {
    id: operation.id,
    entityType: operation.entityType,
    entityId: operation.entityId,
    operation: operation.operation,
    payload: operation.payload,
  };
}

/**
 * Reconcile the server's per-operation verdicts with local state.
 * Exported so the reconciliation rules can be unit-tested without a
 * network or a database.
 */
export async function applyResults(
  sent: SyncOperation[],
  results: SyncOperationResult[],
): Promise<SyncRunSummary> {
  const byId = new Map(results.map((r) => [r.id, r]));
  let succeeded = 0;
  let failed = 0;
  let needsAuth = false;

  for (const operation of sent) {
    const result = byId.get(operation.id);

    // The server did not mention it: treat as a retryable blip rather
    // than assuming success.
    if (!result) {
      await queue.markFailure(operation.id, "server_error");
      failed += 1;
      continue;
    }

    if (result.ok) {
      await queue.markDone(operation.id);
      if (operation.entityType === "GAME_SESSION") {
        await repo.markSessionSynced(operation.entityId, result.serverId ?? null);
      } else if (operation.entityType === "REMINDER_LOG") {
        await repo.markReminderLogSynced(operation.entityId);
      } else if (operation.entityType === "MEMORY_RECALL") {
        await repo.markMemoryRecallSynced(operation.entityId);
      }
      succeeded += 1;
      continue;
    }

    const status = await queue.markFailure(
      operation.id,
      result.errorCode ?? "server_error",
    );
    if (status === "NEEDS_AUTH") needsAuth = true;
    if (status === "FAILED" && operation.entityType === "GAME_SESSION") {
      // Keep the row, flag it, never delete the person's activity.
      await repo.markSessionFailed(operation.entityId);
    }
    if (status === "FAILED" && operation.entityType === "MEMORY_RECALL") {
      // Same rule: the answer stays on the device, marked, so it is
      // visible as unsent work rather than silently discarded.
      await repo.markMemoryRecallFailed(operation.entityId);
    }
    failed += 1;
  }

  if (succeeded > 0) await repo.markSynced();
  return { attempted: sent.length, succeeded, failed, needsAuth };
}

/** Pull a fresh snapshot and replace the local cache atomically. */
export async function pullSnapshot(): Promise<boolean> {
  try {
    const response = await fetch("/api/sync/snapshot", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401) return false;
      connectivity.reportReachable(response.status < 500);
      return false;
    }
    const snapshot = (await response.json()) as OfflineSnapshot;
    if (!snapshot?.userId) return false;

    await repo.applySnapshot(snapshot);
    connectivity.reportReachable(true);
    return true;
  } catch {
    connectivity.reportReachable(false);
    return false;
  }
}

/**
 * The one entry point the UI calls: push what is waiting, then refresh
 * the local copy. Safe to call often — it returns immediately if a run
 * is already in progress or the device is offline.
 */
export async function syncNow(
  options: { pull?: boolean } = {},
): Promise<SyncRunSummary | null> {
  if (running) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return null;
  }

  running = true;
  connectivity.setSyncing(true);
  try {
    const summary = await pushPending();
    if (options.pull !== false) await pullSnapshot();
    return summary;
  } finally {
    running = false;
    connectivity.setSyncing(false);
  }
}

/** After a fresh sign-in, release anything parked on authentication. */
export async function resumeAfterSignIn(): Promise<void> {
  await queue.retryAuthBlocked();
  await syncNow();
}
