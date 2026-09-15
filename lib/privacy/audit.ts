import "server-only";

import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/**
 * PRIVACY — audit logging.
 * -----------------------------------------------------------------
 * A small, deliberately boring record that a sensitive thing happened.
 * Its whole value is being able to answer, months later, "when did they
 * withdraw consent?" or "was an export ever generated for this person?"
 *
 * What it records: WHO acted, WHAT kind of thing they did, WHEN, and a
 * few counts. What it must never record: the contents of anything. No
 * memory text, no note bodies, no reminder titles, no passwords, no
 * tokens, no exported rows. `sanitiseDetail` enforces that rather than
 * trusting call sites to remember.
 *
 * Writing an audit entry must never break the operation it describes —
 * a failed log is reported to the server console and swallowed, because
 * refusing someone's consent withdrawal over a logging error would be
 * the worse failure by a wide margin.
 */

/** Keys that must never reach the audit log, however they are nested. */
const FORBIDDEN_KEYS = [
  "password",
  "passwordhash",
  "token",
  "secret",
  "authsecret",
  "cookie",
  "email",
  "phone",
  "name",
  "title",
  "body",
  "description",
  "note",
  "notes",
  "memory",
  "memories",
  "image",
  "imagepath",
  "photo",
  "connectcode",
  "rows",
  "records",
  "payload",
];

/** Only small scalars survive. Anything else is a shape, not content. */
type DetailValue = string | number | boolean | null;
export type AuditDetail = Record<string, DetailValue>;

/**
 * Strip anything that looks like content before it is stored.
 *
 * Strings are allowed but capped at 64 characters, which is room for a
 * consent version or a machine-readable reason and not room for a
 * person's note. Objects and arrays are dropped outright.
 */
export function sanitiseDetail(detail: Record<string, unknown>): AuditDetail {
  const out: AuditDetail = {};

  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) continue;

    if (value === null) out[key] = null;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 64);
    // Objects, arrays, functions, symbols: dropped. A nested structure
    // is exactly where content hides.
  }

  return out;
}

export async function recordAudit(input: {
  action: AuditAction;
  userId?: string | null;
  caregiverId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        caregiverId: input.caregiverId ?? null,
        detail: input.detail
          ? (sanitiseDetail(input.detail) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    // Never let the audit log fail the operation it is describing.
    console.error("[audit] could not record event:", input.action, error);
  }
}

/** Recent events about one elder, newest first. For support/debugging. */
export async function auditEventsForUser(userId: string, take = 50) {
  return prisma.auditEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
