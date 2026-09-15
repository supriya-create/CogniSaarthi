import { z } from "zod";
import type { CognitiveDomain, Difficulty } from "@prisma/client";

/**
 * RESEARCH DATA — the export representation.
 * -----------------------------------------------------------------
 * This module decides WHAT a research record is allowed to contain. It
 * is pure and imports no database, so the privacy rules below can be
 * tested exhaustively without standing anything up.
 *
 * The design rule is an allowlist, not a denylist. A record is BUILT
 * from a fixed set of permitted fields rather than being a product row
 * with sensitive columns stripped off it — because the stripping
 * approach fails silently the day someone adds a column, and this one
 * fails loudly.
 *
 * Nothing here is ever sent anywhere automatically. Generating an
 * export is an explicit call (see `export-service.ts`), and research
 * export is entirely separate from the optional AI layer: no exported
 * record is handed to a model, here or anywhere else.
 */

// ---------------------------------------------------------------
// Buckets — data minimisation
// ---------------------------------------------------------------

/**
 * Durations are bucketed because the exact millisecond count is both
 * unnecessary for the question ("did this take a short or a long time?")
 * and unhelpfully distinctive: an exact duration paired with an exact
 * timestamp is close to a fingerprint.
 */
export type DurationBucket = "<30s" | "30-60s" | "1-2m" | "2-5m" | "5m+";

export function durationBucket(durationMs: number): DurationBucket {
  const seconds = Math.max(0, durationMs) / 1000;
  if (seconds < 30) return "<30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 120) return "1-2m";
  if (seconds < 300) return "2-5m";
  return "5m+";
}

/**
 * Timestamps are reduced to the calendar month, in UTC.
 *
 * A month is enough to see change over time, which is the only temporal
 * question an aggregate analysis of this data can honestly ask. An exact
 * instant would reveal daily routine — when someone wakes, when they are
 * alone — which is a great deal more than was consented to.
 */
export function monthBucket(at: Date): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Rates are rounded to 2 decimals; more precision is spurious anyway. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------
// The record
// ---------------------------------------------------------------

export const DURATION_BUCKETS: DurationBucket[] = [
  "<30s",
  "30-60s",
  "1-2m",
  "2-5m",
  "5m+",
];

/**
 * The ONLY fields an export may contain.
 *
 * `.strict()` is load-bearing: a record carrying so much as an extra
 * `name` key fails validation instead of being quietly exported. That is
 * the difference between a privacy boundary and a privacy intention.
 */
export const researchExportRecordSchema = z
  .object({
    /** HMAC-derived. Never a userId, email, phone or connect code. */
    anonymousParticipantId: z.string().regex(/^[0-9a-f]{32}$/),
    domain: z.enum([
      "SHORT_TERM_MEMORY",
      "ATTENTION",
      "WORKING_MEMORY",
      "LANGUAGE",
      "PROCESSING_SPEED",
      "EXECUTIVE_FUNCTION",
    ]),
    gameType: z.string().min(1).max(40),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    accuracy: z.number().min(0).max(1),
    completion: z.number().min(0).max(1),
    hintRate: z.number().min(0).max(1),
    sessionDurationBucket: z.enum(["<30s", "30-60s", "1-2m", "2-5m", "5m+"]),
    timestampBucket: z.string().regex(/^\d{4}-\d{2}$/),
    consentVersion: z.string().min(1).max(40),
  })
  .strict();

export type ResearchExportRecord = z.infer<typeof researchExportRecordSchema>;

/** Input to the builder — plain product values, not a Prisma row. */
export interface ExportableSession {
  participantId: string;
  gameId: string;
  domain: CognitiveDomain;
  difficulty: Difficulty;
  roundsTotal: number;
  roundsCompleted: number;
  correctCount: number;
  incorrectCount: number;
  hints: number;
  durationMs: number;
  occurredAt: Date;
  consentVersion: string;
}

/**
 * Build one record. Note what is NOT a parameter: there is no way to
 * pass a name, an email, a caregiver, a memory or a note into this
 * function, because the type will not accept one.
 */
export function buildExportRecord(
  session: ExportableSession,
): ResearchExportRecord {
  const answered = session.correctCount + session.incorrectCount;

  return {
    anonymousParticipantId: session.participantId,
    domain: session.domain,
    gameType: session.gameId,
    difficulty: session.difficulty,
    accuracy: answered > 0 ? round2(session.correctCount / answered) : 0,
    completion:
      session.roundsTotal > 0
        ? round2(
            Math.min(1, session.roundsCompleted / session.roundsTotal),
          )
        : 0,
    // Per answered item, so a long activity is not penalised for having
    // had more chances to offer a hint.
    hintRate: answered > 0 ? round2(Math.min(1, session.hints / answered)) : 0,
    sessionDurationBucket: durationBucket(session.durationMs),
    timestampBucket: monthBucket(session.occurredAt),
    consentVersion: session.consentVersion,
  };
}

// ---------------------------------------------------------------
// Validation — nothing malformed leaves silently
// ---------------------------------------------------------------

/**
 * Turn Zod issues into a readable reason.
 *
 * The `unrecognized_keys` case is spelled out rather than left as a
 * bare code: when a record is rejected for carrying an extra field, the
 * NAME of that field is the whole point — it says which piece of
 * personal data nearly escaped. "unrecognized_keys" alone would leave
 * whoever reads the log no better off.
 */
function describeIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .map((issue) => {
      const where = issue.path.join(".") || "(root)";
      if (issue.code === "unrecognized_keys") {
        return `${where}: unrecognized_keys [${issue.keys.join(", ")}]`;
      }
      return `${where}: ${issue.code}`;
    })
    .join("; ");
}

export interface ValidationOutcome {
  valid: ResearchExportRecord[];
  /** Rejected records, with the reason. Reported, never swallowed. */
  rejected: { index: number; reason: string }[];
}

/**
 * Validate every record before it is written anywhere.
 *
 * Invalid records are DROPPED and COUNTED. They are never repaired and
 * never passed through: a record that fails this schema is either
 * malformed or carrying a field it should not have, and neither is
 * something to fix up quietly on the way out of the door.
 */
export function validateExport(records: unknown[]): ValidationOutcome {
  const valid: ResearchExportRecord[] = [];
  const rejected: { index: number; reason: string }[] = [];

  records.forEach((record, index) => {
    const parsed = researchExportRecordSchema.safeParse(record);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      rejected.push({ index, reason: describeIssues(parsed.error.issues) });
    }
  });

  return { valid, rejected };
}

/** Field names that must never appear on an export record. */
export const FORBIDDEN_EXPORT_FIELDS = [
  "userId",
  "id",
  "name",
  "email",
  "phone",
  "connectCode",
  "caregiverId",
  "caregiverName",
  "memoryId",
  "imagePath",
  "photo",
  "description",
  "relationship",
  "note",
  "notes",
  "emergencyContact",
  "token",
  "passwordHash",
  "startedAt",
  "completedAt",
  "durationMs",
  "timeZone",
];

/**
 * A second, independent check that the allowlist actually held.
 *
 * Redundant with `.strict()` on purpose. This is the assertion a test
 * can point at directly, and the one that would catch a future schema
 * edit that adds a field somebody should have thought harder about.
 */
export function containsForbiddenField(record: object): string | null {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_EXPORT_FIELDS.includes(key)) return key;
  }
  return null;
}
