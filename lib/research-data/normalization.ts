import type { CognitiveDomain } from "@prisma/client";

import { clamp } from "@/lib/cognitive-performance/metrics";
import type { MappedMeasure, ResearchRecord } from "@/lib/research-data/types";

/**
 * RESEARCH DATA — normalisation.
 * -----------------------------------------------------------------
 * Puts an external study's raw scores onto the SAME 0–100 scale
 * `lib/cognitive-performance/metrics.ts` uses, so the two data worlds
 * can be COMPARED without ever being MERGED.
 *
 * That distinction is the whole point of this folder. A study score and
 * a Cognisaarthi gameplay score can sit side by side in an analysis;
 * neither may be written into the other's records, because they measure
 * different things under different conditions and conflating them would
 * lend our activity scores a clinical meaning they do not have.
 */

/** How one study column maps onto a Cognisaarthi domain. */
export interface ColumnMapping {
  column: string;
  domain: CognitiveDomain;
  /** The study's own scale, used to normalise to 0–100. */
  min: number;
  max: number;
}

/** Linear rescale to 0–100, clamped. Null in, null out — never a guess. */
export function normaliseScore(
  value: number | null,
  min: number,
  max: number,
): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (max <= min) return null;
  return clamp(((value - min) / (max - min)) * 100);
}

/**
 * Apply a mapping to de-identified records. Rows whose measure is
 * missing are dropped rather than imputed: an invented value in a
 * research comparison is worse than a smaller sample.
 */
export function mapRecords(
  records: ResearchRecord[],
  mappings: ColumnMapping[],
): MappedMeasure[] {
  const out: MappedMeasure[] = [];

  for (const record of records) {
    for (const mapping of mappings) {
      const raw = record.measures[mapping.column];
      const normalised = normaliseScore(
        raw === undefined ? null : raw,
        mapping.min,
        mapping.max,
      );
      if (normalised === null) continue;

      out.push({
        participantId: record.participantId,
        domain: mapping.domain,
        normalised,
        sourceColumn: mapping.column,
      });
    }
  }

  return out;
}
