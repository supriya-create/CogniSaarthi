import type { ReminderLogStatus } from "@prisma/client";

/**
 * CONFLICT RESOLUTION (pure and deterministic)
 * -----------------------------------------------------------------
 * The same reminder occurrence can be answered on this device while
 * offline and, separately, already carry a state on the server. Plain
 * last-write-wins is wrong here: it can quietly undo a person's answer
 * because a clock drifted, or let a system-generated "missed" marker
 * erase a real "done".
 *
 * So acknowledgement is treated as an EVENT and resolved by rank, then
 * by time, then by a fixed precedence. The rules, in order:
 *
 *   1. A human answer always beats a system marker. DONE/SKIPPED (and
 *      even SNOOZED) beat MISSED and PENDING, whatever the timestamps —
 *      MISSED is only ever inferred by the app, never chosen by anyone.
 *   2. A finished answer beats a postponement. DONE/SKIPPED beat
 *      SNOOZED, so "remind me later" recorded earlier cannot undo a
 *      later "done".
 *   3. Between two answers of equal standing, the LATEST valid
 *      acknowledgement event wins.
 *   4. If they are still tied (same rank, same or missing time), a
 *      fixed status precedence decides, so every device converges on
 *      the same answer rather than flip-flopping.
 *
 * Game sessions need no rule here: they are created on one device with
 * a unique client id, and the server's recomputed score is always
 * authoritative.
 */

export type ConflictSide = "local" | "server";

export interface AckEvent {
  status: ReminderLogStatus;
  /** When the person answered (or the marker was written). */
  at: Date | null;
}

export type ConflictReason =
  | "localOnly"
  | "serverOnly"
  | "identical"
  | "humanBeatsSystem"
  | "answerBeatsSnooze"
  | "latestEvent"
  | "statusPrecedence";

export interface ConflictResolution {
  winner: ConflictSide;
  status: ReminderLogStatus;
  at: Date | null;
  reason: ConflictReason;
}

/**
 * Standing of a status:
 *   2 — a finished answer a person gave
 *   1 — a postponement a person chose
 *   0 — a system marker or no answer at all
 */
function rank(status: ReminderLogStatus): number {
  switch (status) {
    case "DONE":
    case "SKIPPED":
      return 2;
    case "SNOOZED":
      return 1;
    case "MISSED":
    case "PENDING":
    default:
      return 0;
  }
}

/** Fixed tie-break order, so both devices land on the same answer. */
const PRECEDENCE: ReminderLogStatus[] = [
  "DONE",
  "SKIPPED",
  "SNOOZED",
  "MISSED",
  "PENDING",
];

function precedenceOf(status: ReminderLogStatus): number {
  const index = PRECEDENCE.indexOf(status);
  return index === -1 ? PRECEDENCE.length : index;
}

function time(event: AckEvent): number {
  return event.at ? event.at.getTime() : 0;
}

export function resolveReminderConflict(
  local: AckEvent | null,
  server: AckEvent | null,
): ConflictResolution {
  if (local && !server) {
    return { winner: "local", status: local.status, at: local.at, reason: "localOnly" };
  }
  if (server && !local) {
    return {
      winner: "server",
      status: server.status,
      at: server.at,
      reason: "serverOnly",
    };
  }
  if (!local || !server) {
    // Neither side has anything: nothing to resolve, treat as pending.
    return { winner: "server", status: "PENDING", at: null, reason: "identical" };
  }

  if (local.status === server.status && time(local) === time(server)) {
    return {
      winner: "server",
      status: server.status,
      at: server.at,
      reason: "identical",
    };
  }

  const localRank = rank(local.status);
  const serverRank = rank(server.status);

  if (localRank !== serverRank) {
    const winnerSide: ConflictSide = localRank > serverRank ? "local" : "server";
    const winner = winnerSide === "local" ? local : server;
    const loser = winnerSide === "local" ? server : local;
    // Name the rule that actually decided it.
    const reason: ConflictReason =
      rank(loser.status) === 0 ? "humanBeatsSystem" : "answerBeatsSnooze";
    return { winner: winnerSide, status: winner.status, at: winner.at, reason };
  }

  // Equal standing → the later genuine event wins.
  if (time(local) !== time(server)) {
    const winnerSide: ConflictSide =
      time(local) > time(server) ? "local" : "server";
    const winner = winnerSide === "local" ? local : server;
    return {
      winner: winnerSide,
      status: winner.status,
      at: winner.at,
      reason: "latestEvent",
    };
  }

  // Same standing, same instant, different status → fixed precedence.
  const winnerSide: ConflictSide =
    precedenceOf(local.status) <= precedenceOf(server.status) ? "local" : "server";
  const winner = winnerSide === "local" ? local : server;
  return {
    winner: winnerSide,
    status: winner.status,
    at: winner.at,
    reason: "statusPrecedence",
  };
}

/** True when the local record should be pushed to the server. */
export function localShouldWin(
  local: AckEvent | null,
  server: AckEvent | null,
): boolean {
  return resolveReminderConflict(local, server).winner === "local";
}
