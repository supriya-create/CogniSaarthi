import "server-only";

import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/privacy/audit";
import {
  activityIsResearchEligible,
  CURRENT_CONSENT_VERSION,
} from "@/lib/privacy/consent";
import {
  MissingPseudonymSecretError,
  participantId,
  pseudonymSecretConfigured,
} from "@/lib/privacy/pseudonymise";
import { consentWindow, getConsentStatus } from "@/lib/privacy/server";
import {
  buildExportRecord,
  validateExport,
  type ResearchExportRecord,
} from "@/lib/research-data/export";

/**
 * RESEARCH DATA — the export service.
 * -----------------------------------------------------------------
 * The one place product data is turned into a research representation.
 *
 * **It is deliberately not reachable over HTTP.** There is no
 * `/api/research/export` route, because there is no research-admin role
 * to authorise one — and an export endpoint whose only protection is
 * "nobody knows the URL" is not protected. The service exists, is
 * tested, and is called from a server context by someone with database
 * access. When a real authorised role exists, that is the moment to add
 * a route; see §17 of the Phase 7 notes and docs/research-data.md.
 *
 * The rules it enforces, in order:
 *
 *   1. No secret configured    → refuse outright.
 *   2. No current consent      → zero records, and say why.
 *   3. Activity outside the consented window → excluded.
 *   4. Only allowlisted fields → built, never stripped.
 *   5. Every record validated  → invalid ones counted, never emitted.
 *
 * Personal memories, caregiver notes, reminders, alerts and emergency
 * contacts are not read by this module at all. Not filtered out —
 * never loaded.
 */

export interface ResearchExport {
  records: ResearchExportRecord[];
  /** Machine-readable reason when nothing was exported. */
  skippedReason:
    | null
    | "no_consent"
    | "consent_withdrawn"
    | "consent_superseded"
    | "no_eligible_activity";
  summary: {
    consideredSessions: number;
    /** Excluded because they fell outside the consented window. */
    outsideConsentWindow: number;
    /** Failed schema validation and were dropped. */
    rejected: number;
    exported: number;
    consentVersion: string;
  };
}

function emptyExport(
  reason: NonNullable<ResearchExport["skippedReason"]>,
  considered = 0,
): ResearchExport {
  return {
    records: [],
    skippedReason: reason,
    summary: {
      consideredSessions: considered,
      outsideConsentWindow: 0,
      rejected: 0,
      exported: 0,
      consentVersion: CURRENT_CONSENT_VERSION,
    },
  };
}

/**
 * Build the research representation of ONE person's activity.
 *
 * Returns an empty export rather than throwing when consent is absent:
 * "this person has not consented" is a normal, expected outcome of a
 * cohort export, not an error condition.
 *
 * Throws only when the server is misconfigured — a missing
 * pseudonymisation secret is a deployment fault, and continuing would
 * mean emitting identifiers that are not really pseudonymous.
 */
export async function buildResearchExportForUser(
  userId: string,
): Promise<ResearchExport> {
  if (!pseudonymSecretConfigured()) throw new MissingPseudonymSecretError();

  const status = await getConsentStatus(userId);

  if (!status.researchEligible) {
    if (status.state === "WITHDRAWN") return emptyExport("consent_withdrawn");
    if (status.state === "SUPERSEDED") return emptyExport("consent_superseded");
    return emptyExport("no_consent");
  }

  const { consentedAt, withdrawnAt } = await consentWindow(userId);

  // Only completed sessions, and only the columns an export can use.
  // `select` rather than `include` so a future column on GameSession
  // cannot drift into this query unnoticed.
  const sessions = await prisma.gameSession.findMany({
    where: { userId, status: "COMPLETED" },
    select: {
      gameId: true,
      difficulty: true,
      roundsTotal: true,
      roundsCompleted: true,
      completedAt: true,
      startedAt: true,
      durationMs: true,
      game: { select: { domain: true } },
      result: {
        select: { correctCount: true, incorrectCount: true, hints: true },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  const pid = participantId(userId);
  const candidates: unknown[] = [];
  let outsideConsentWindow = 0;

  for (const session of sessions) {
    const occurredAt = session.completedAt ?? session.startedAt;

    if (
      !activityIsResearchEligible({ occurredAt, consentedAt, withdrawnAt })
    ) {
      outsideConsentWindow += 1;
      continue;
    }

    if (!session.result) continue;

    candidates.push(
      buildExportRecord({
        participantId: pid,
        gameId: session.gameId,
        domain: session.game.domain,
        difficulty: session.difficulty,
        roundsTotal: session.roundsTotal,
        roundsCompleted: session.roundsCompleted,
        correctCount: session.result.correctCount,
        incorrectCount: session.result.incorrectCount,
        hints: session.result.hints,
        durationMs: session.durationMs ?? 0,
        occurredAt,
        consentVersion: CURRENT_CONSENT_VERSION,
      }),
    );
  }

  const { valid, rejected } = validateExport(candidates);

  if (valid.length === 0) {
    const empty = emptyExport("no_eligible_activity", sessions.length);
    empty.summary.outsideConsentWindow = outsideConsentWindow;
    empty.summary.rejected = rejected.length;
    return empty;
  }

  return {
    records: valid,
    skippedReason: null,
    summary: {
      consideredSessions: sessions.length,
      outsideConsentWindow,
      rejected: rejected.length,
      exported: valid.length,
      consentVersion: CURRENT_CONSENT_VERSION,
    },
  };
}

/**
 * Build a cohort export across every consenting person.
 *
 * Audited as one event with counts only — how many participants, how
 * many records. Never which participants.
 */
export async function buildResearchExport(): Promise<ResearchExport> {
  if (!pseudonymSecretConfigured()) throw new MissingPseudonymSecretError();

  const consenting = await prisma.researchConsent.findMany({
    where: {
      version: CURRENT_CONSENT_VERSION,
      consented: true,
      withdrawnAt: null,
    },
    select: { userId: true },
  });

  const records: ResearchExportRecord[] = [];
  let consideredSessions = 0;
  let outsideConsentWindow = 0;
  let rejected = 0;

  for (const { userId } of consenting) {
    const one = await buildResearchExportForUser(userId);
    records.push(...one.records);
    consideredSessions += one.summary.consideredSessions;
    outsideConsentWindow += one.summary.outsideConsentWindow;
    rejected += one.summary.rejected;
  }

  await recordAudit({
    action: "RESEARCH_EXPORT_GENERATED",
    // Counts only. The key is `recordCount`, not `records`, because
    // `sanitiseDetail` strips anything named `records` outright — it
    // cannot tell a count from the rows themselves, and refusing both
    // is the right way round for a guard like that to be wrong.
    detail: {
      participantCount: consenting.length,
      recordCount: records.length,
      rejected,
      version: CURRENT_CONSENT_VERSION,
    },
  });

  return {
    records,
    skippedReason: records.length === 0 ? "no_eligible_activity" : null,
    summary: {
      consideredSessions,
      outsideConsentWindow,
      rejected,
      exported: records.length,
      consentVersion: CURRENT_CONSENT_VERSION,
    },
  };
}
