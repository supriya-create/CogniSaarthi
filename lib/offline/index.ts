/**
 * OFFLINE-FIRST — public surface.
 *
 * The pieces:
 *   types          — local entities, queue operations, snapshot shape
 *   serialization  — ISO dates, plain-data payloads, client ids
 *   conflicts      — deterministic reminder-answer resolution (pure)
 *   schema / db    — IndexedDB stores and a small promise wrapper
 *   repositories   — typed local reads/writes, snapshot merging
 *   queue          — durable work list with bounded backoff
 *   connectivity   — ONLINE / OFFLINE / SYNCING, confirmed by health check
 *   sync           — push queued work, then pull a fresh snapshot
 *   actions        — what the UI calls: play a game, answer a reminder
 *
 * PostgreSQL stays authoritative. IndexedDB is a local replica and an
 * offline workspace, never the source of truth.
 */
export * from "@/lib/offline/types";
export * from "@/lib/offline/serialization";
export * from "@/lib/offline/conflicts";
export * from "@/lib/offline/connectivity";
export * from "@/lib/offline/actions";
export { syncNow, pullSnapshot, pushPending, resumeAfterSignIn } from "@/lib/offline/sync";
export * as offlineDb from "@/lib/offline/db";
export * as offlineQueue from "@/lib/offline/queue";
export * as offlineRepo from "@/lib/offline/repositories";
