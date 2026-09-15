import type { CognitiveDomain } from "@prisma/client";

/**
 * RESEARCH DATA — types only. NO DATASET IS BUNDLED.
 * -----------------------------------------------------------------
 * This describes the SHAPE an external cognitive-ageing dataset would
 * take if one were ever licensed and loaded, so the boundary between it
 * and Cognisaarthi's own interaction data is defined in code rather
 * than left to good intentions.
 *
 * Read `README.md` in this folder before adding anything here. The
 * short version:
 *
 *  - No dataset file may enter this repository, ever.
 *  - Study records are for research and validation, OFFLINE. They must
 *    never drive a live user's difficulty or appear in the app.
 *  - Nothing here is imported by the Next.js runtime.
 */

/** A participant record from an external study, de-identified. */
export interface ResearchRecord {
  /** Study-local pseudonymous id. Never a Cognisaarthi user id. */
  participantId: string;
  /** Age band rather than an exact age, to limit re-identification. */
  ageBand?: string;
  /** Raw assessment scores, keyed by the study's own column names. */
  measures: Record<string, number | null>;
}

/**
 * A study measure mapped onto one of Cognisaarthi's domains — for
 * COMPARISON only. No value is ever copied into a user's profile.
 */
export interface MappedMeasure {
  participantId: string;
  domain: CognitiveDomain;
  /** Normalised to the same 0–100 scale the app's metrics use. */
  normalised: number;
  sourceColumn: string;
}

/** Where a dataset came from, recorded so provenance is never guessed. */
export interface DatasetDescriptor {
  name: string;
  /** True only when files are genuinely present outside the repo. */
  available: boolean;
  /** Access-controlled datasets carry a data-use agreement. */
  accessControlled: boolean;
  notes: string;
}

/**
 * The seam a real loader would implement. Nothing in the repository
 * implements it — see `adapters.ts`.
 */
export interface ResearchDataAdapter {
  descriptor: DatasetDescriptor;
  /** Load de-identified records from a path OUTSIDE the repository. */
  load(): Promise<ResearchRecord[]>;
  /** Map the study's columns onto Cognisaarthi's domains. */
  map(records: ResearchRecord[]): MappedMeasure[];
}
