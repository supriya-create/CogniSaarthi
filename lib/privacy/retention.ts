/**
 * PRIVACY — data retention policy.
 * -----------------------------------------------------------------
 * A written, configurable policy rather than a set of numbers buried in
 * a delete query. Pure functions only: this module DECIDES what is
 * eligible for removal, and nothing here deletes anything. Applying a
 * policy is a separate, deliberate act (see `data-deletion.ts`).
 *
 * The honest position on the periods below: they are **product
 * choices**, not legal requirements. Cognisaarthi is not a medical
 * record system and is not subject to a clinical retention statute, so
 * inventing a "7 years, as required by law" would be a fiction. Each
 * period is justified by what the feature needs in order to work, and
 * every one is overridable by configuration.
 */

/** Who controls how long a category is kept. */
export type RetentionControl =
  /** Kept for a fixed period, then eligible for removal. */
  | "POLICY"
  /** Kept until the person (or their caregiver) removes it. */
  | "USER"
  /** Kept only while consent permits it. */
  | "CONSENT";

export interface RetentionRule {
  category: string;
  /** Why the data exists at all. */
  purpose: string;
  control: RetentionControl;
  /**
   * Days after which a record is eligible for removal. Null when the
   * category is user- or consent-controlled and has no clock.
   */
  days: number | null;
  /** Why this period and not another. Shown in the documentation. */
  rationale: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The default policy.
 *
 * `GAME_SESSION` at two years is the longest period, because the Phase 6
 * longitudinal layer describes change over months and a shorter window
 * would quietly amputate the feature the caregiver dashboard is built
 * on. `REMINDER_LOG` at one year covers "this time last year" without
 * accumulating a minute-by-minute diary indefinitely. `ALERT` at 180
 * days is well past the point anyone acts on one.
 */
export const DEFAULT_RETENTION: RetentionRule[] = [
  {
    category: "GAME_SESSION",
    purpose:
      "Product functionality — history, adaptive difficulty, and the longitudinal view the caregiver dashboard shows.",
    control: "POLICY",
    days: 730,
    rationale:
      "The trend layer compares months to months; two years is the shortest window that still supports a year-over-year comparison. Not a legal period — a product one.",
  },
  {
    category: "REMINDER_LOG",
    purpose: "Routine functionality and the caregiver's view of the day.",
    control: "POLICY",
    days: 365,
    rationale:
      "Occurrence-level answers are only useful while the routine they belong to is recent. A year covers seasonal routines without keeping an indefinite diary.",
  },
  {
    category: "ALERT",
    purpose: "Caregiver attention signals.",
    control: "POLICY",
    days: 180,
    rationale:
      "An alert nobody acted on within six months is no longer a signal. Resolved and dismissed ones are kept for the same period so the trail survives a tidy-up.",
  },
  {
    category: "PERSONAL_MEMORY",
    purpose: "Memory assistance — the elder's own people, places and moments.",
    control: "USER",
    days: null,
    rationale:
      "The most personal data in the product, and the least suitable for an automatic clock. It stays until the elder or their caregiver removes it, and is deleted with the account.",
  },
  {
    category: "CAREGIVER_NOTE",
    purpose: "Caregiver support — free-text observations.",
    control: "USER",
    days: null,
    rationale:
      "Written by a person about a person. Deleting someone's notes on a timer would lose context they chose to keep.",
  },
  {
    category: "RESEARCH_REPRESENTATION",
    purpose: "Improving Cognisaarthi, in aggregate.",
    control: "CONSENT",
    days: null,
    rationale:
      "Not separately stored: a research export is DERIVED from product data at the moment it is generated, and only from activity inside a consented window. Withdrawing consent ends eligibility immediately; there is no separate copy to expire.",
  },
  {
    category: "AUDIT_EVENT",
    purpose: "Being able to answer questions about consent and exports later.",
    control: "POLICY",
    days: 1095,
    rationale:
      "Three years, longer than the data it describes, because an audit log that expires before its subject cannot corroborate anything. Contains no content — only that something happened.",
  },
];

export function retentionRule(
  category: string,
  policy: RetentionRule[] = DEFAULT_RETENTION,
): RetentionRule | null {
  return policy.find((rule) => rule.category === category) ?? null;
}

/**
 * Whether one record is past its retention period.
 *
 * User- and consent-controlled categories always return false: they
 * have no clock, and answering "yes, expired" for them would be how a
 * person's memories quietly disappear.
 */
export function isExpired(input: {
  category: string;
  createdAt: Date;
  now?: Date;
  policy?: RetentionRule[];
}): boolean {
  const rule = retentionRule(input.category, input.policy);
  if (!rule || rule.days === null) return false;

  const now = input.now ?? new Date();
  return now.getTime() - input.createdAt.getTime() > rule.days * DAY_MS;
}

/** The cut-off instant for a category — records older than this expire. */
export function expiryCutoff(
  category: string,
  now: Date = new Date(),
  policy: RetentionRule[] = DEFAULT_RETENTION,
): Date | null {
  const rule = retentionRule(category, policy);
  if (!rule || rule.days === null) return null;
  return new Date(now.getTime() - rule.days * DAY_MS);
}

/**
 * Split records into what may be removed and what is protected.
 * Returned rather than acted on, so a policy run can be reviewed before
 * anything is destroyed.
 */
export function partitionByRetention<T extends { createdAt: Date }>(input: {
  category: string;
  records: T[];
  now?: Date;
  policy?: RetentionRule[];
}): { expired: T[]; retained: T[] } {
  const expired: T[] = [];
  const retained: T[] = [];

  for (const record of input.records) {
    if (
      isExpired({
        category: input.category,
        createdAt: record.createdAt,
        now: input.now,
        policy: input.policy,
      })
    ) {
      expired.push(record);
    } else {
      retained.push(record);
    }
  }

  return { expired, retained };
}
