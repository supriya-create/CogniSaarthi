import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PRIVACY — pseudonymous participant identifiers.
 * -----------------------------------------------------------------
 * A research export must not carry `userId`, and it must not carry a
 * name, an email or a connect code. But an analysis still needs to know
 * that forty activity records came from the same person — otherwise
 * every row is an independent observation, which is simply false.
 *
 * So: a deterministic HMAC of the user id under a server-held secret.
 * Same person, same id, every time; and the mapping cannot be reversed
 * or recomputed by anyone without the secret.
 *
 * ## This is PSEUDONYMISATION, not anonymisation.
 *
 * The distinction is not pedantry, and this file will not blur it:
 *
 *  - The secret exists. Whoever holds it can re-derive the participant
 *    id for a known user id and confirm a match. That is a re-
 *    identification path, so the data is pseudonymous, not anonymous.
 *  - Linkage survives by design. A long enough behavioural sequence can
 *    be distinctive even without a name attached.
 *
 * Calling this "anonymised" would overstate the protection to the
 * person consenting, which is exactly the kind of claim this codebase
 * refuses to make. The consent copy says "not linked to your name",
 * which is true, rather than "anonymous", which is not.
 */

/**
 * The secret is separate from `AUTH_SECRET` on purpose: rotating session
 * signing must not silently re-pseudonymise an entire research cohort,
 * and a leaked session secret must not hand over the identity mapping.
 */
const SECRET_ENV = "RESEARCH_EXPORT_SECRET";

export class MissingPseudonymSecretError extends Error {
  constructor() {
    super(
      `${SECRET_ENV} is not set. Research export is disabled until a dedicated secret is configured — exporting under a guessable or shared key would make the pseudonymous ids reversible.`,
    );
    this.name = "MissingPseudonymSecretError";
  }
}

export function pseudonymSecretConfigured(): boolean {
  const value = process.env[SECRET_ENV];
  return typeof value === "string" && value.length >= 32;
}

function secret(): string {
  const value = process.env[SECRET_ENV];
  // Refuse rather than fall back. A short or absent key would produce
  // ids that look pseudonymous and are not.
  if (!value || value.length < 32) throw new MissingPseudonymSecretError();
  return value;
}

/**
 * The exported identifier for one person.
 *
 * Namespaced by `purpose` so the same person carries a DIFFERENT id in
 * two different exports. Without that, two datasets released separately
 * could be joined on the identifier, recombining exactly the linkage
 * each export was minimised to avoid.
 */
export function participantId(
  userId: string,
  purpose = "research-improvement",
): string {
  return createHmac("sha256", secret())
    .update(`${purpose}:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Confirm that a participant id belongs to a given user — for a support
 * request ("please remove my data") where the person can only quote the
 * pseudonymous id. Constant-time, so this cannot be used as an oracle.
 */
export function participantIdMatches(
  candidate: string,
  userId: string,
  purpose = "research-improvement",
): boolean {
  const expected = participantId(userId, purpose);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}
