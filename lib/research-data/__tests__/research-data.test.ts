import { describe, expect, it } from "vitest";

import {
  anyDatasetAvailable,
  datasetIntegrationStatus,
  getAdapter,
  LASI_DAD,
  listDescriptors,
} from "@/lib/research-data/adapters";
import { mapRecords, normaliseScore } from "@/lib/research-data/normalization";
import { parseDataset, researchRecordSchema } from "@/lib/research-data/validation";

/**
 * The research-data boundary. These tests exist to stop the project
 * ever claiming more than it has: the status function is what the
 * README and the final report both quote, so it cannot quietly drift.
 */

describe("dataset integration status", () => {
  it("reports honestly that NO dataset is integrated", () => {
    expect(datasetIntegrationStatus()).toBe("NO_DATASET_INTEGRATED");
    expect(anyDatasetAvailable()).toBe(false);
    expect(getAdapter("LASI-DAD")).toBeNull();
  });

  it("lists LASI-DAD as known but unavailable and access-controlled", () => {
    expect(LASI_DAD.available).toBe(false);
    expect(LASI_DAD.accessControlled).toBe(true);
    expect(listDescriptors().every((d) => d.available === false)).toBe(true);
  });
});

describe("normalisation", () => {
  it("rescales a study score onto the app's 0-100 scale", () => {
    expect(normaliseScore(5, 0, 10)).toBe(50);
    expect(normaliseScore(0, 0, 10)).toBe(0);
    expect(normaliseScore(10, 0, 10)).toBe(100);
  });

  it("clamps out-of-range values instead of producing nonsense", () => {
    expect(normaliseScore(20, 0, 10)).toBe(100);
    expect(normaliseScore(-5, 0, 10)).toBe(0);
  });

  it("returns null rather than imputing a missing measure", () => {
    expect(normaliseScore(null, 0, 10)).toBeNull();
    expect(normaliseScore(5, 10, 10)).toBeNull();
  });

  it("drops rows with missing measures rather than guessing", () => {
    const mapped = mapRecords(
      [
        { participantId: "p1", measures: { recall: 8, attention: null } },
        { participantId: "p2", measures: { recall: 4 } },
      ],
      [
        { column: "recall", domain: "SHORT_TERM_MEMORY", min: 0, max: 10 },
        { column: "attention", domain: "ATTENTION", min: 0, max: 10 },
      ],
    );
    expect(mapped).toHaveLength(2);
    expect(mapped.every((m) => m.domain !== "ATTENTION")).toBe(true);
  });
});

describe("validation acts as a privacy filter", () => {
  it("accepts a properly de-identified record", () => {
    expect(
      researchRecordSchema.safeParse({
        participantId: "p-001",
        ageBand: "70-74",
        measures: { recall: 7 },
      }).success,
    ).toBe(true);
  });

  it("rejects a record carrying direct identifiers", () => {
    expect(
      researchRecordSchema.safeParse({
        participantId: "p-001",
        name: "Real Person",
        measures: { recall: 7 },
      }).success,
    ).toBe(false);

    expect(
      researchRecordSchema.safeParse({
        participantId: "p-001",
        measures: { recall: 7, dob: 1950 },
      }).success,
    ).toBe(false);
  });

  it("reports rejects rather than silently halving a dataset", () => {
    const { records, rejected } = parseDataset([
      { participantId: "ok", measures: { recall: 5 } },
      { nonsense: true },
      { participantId: "bad", email: "x@y.z", measures: {} },
    ]);
    expect(records).toHaveLength(1);
    expect(rejected).toBe(2);
  });
});
