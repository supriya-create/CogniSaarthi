import { z } from "zod";

/**
 * RESEARCH DATA — validation.
 * -----------------------------------------------------------------
 * Anything loaded from outside the repository is untrusted input and is
 * parsed before use, exactly like an API body.
 *
 * The schema also acts as a PRIVACY FILTER. It accepts a pseudonymous
 * participant id, an optional age band and numeric measures — and
 * nothing else. Direct identifiers are rejected outright rather than
 * quietly passed along, so a file containing names or dates of birth
 * fails loudly instead of flowing into an analysis.
 */

/** Fields that must never appear in a de-identified research file. */
export const DISALLOWED_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "dob",
  "dateOfBirth",
  "address",
  "phone",
  "email",
  "aadhaar",
  "nationalId",
];

export const researchRecordSchema = z
  .object({
    participantId: z.string().trim().min(1).max(64),
    ageBand: z.string().trim().max(16).optional(),
    measures: z.record(z.string(), z.number().nullable()),
  })
  .strict() // reject anything not declared above
  .refine(
    (record) =>
      !DISALLOWED_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(record.measures, field),
      ),
    { message: "Research records must not contain direct identifiers." },
  );

export const researchDatasetSchema = z.array(researchRecordSchema);

export type ParsedResearchRecord = z.infer<typeof researchRecordSchema>;

/**
 * Parse a loaded file. Returns the valid rows and a count of rejects,
 * so a partially malformed dataset is reported rather than silently
 * halved.
 */
export function parseDataset(raw: unknown): {
  records: ParsedResearchRecord[];
  rejected: number;
} {
  if (!Array.isArray(raw)) return { records: [], rejected: 0 };

  const records: ParsedResearchRecord[] = [];
  let rejected = 0;

  for (const row of raw) {
    const parsed = researchRecordSchema.safeParse(row);
    if (parsed.success) records.push(parsed.data);
    else rejected += 1;
  }

  return { records, rejected };
}
