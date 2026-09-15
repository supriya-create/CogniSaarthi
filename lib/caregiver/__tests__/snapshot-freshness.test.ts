import { describe, expect, it } from "vitest";

import {
  CAREGIVER_SNAPSHOT_VERSION,
  describeAge,
  SNAPSHOT_STALE_MS,
  SNAPSHOT_TTL_MS,
  snapshotFreshness,
  stalenessMessage,
} from "@/lib/caregiver/snapshot-types";

/**
 * Staleness, which is the whole safety story for caregiver offline.
 *
 * The single most important assertion in this file is the last one: no
 * wording produced for a saved snapshot may suggest it is current.
 */

const NOW = new Date("2026-09-15T12:00:00.000Z");
const MINUTE = 60_000;

function snap(ageMs: number, version = CAREGIVER_SNAPSHOT_VERSION) {
  const generated = new Date(NOW.getTime() - ageMs);
  return {
    snapshotVersion: version,
    generatedAt: generated.toISOString(),
    expiresAt: new Date(generated.getTime() + SNAPSHOT_TTL_MS).toISOString(),
  };
}

describe("freshness", () => {
  it("is FRESH just after generation", () => {
    expect(snapshotFreshness(snap(MINUTE), NOW)).toBe("FRESH");
  });

  it("becomes STALE at the staleness threshold", () => {
    expect(snapshotFreshness(snap(SNAPSHOT_STALE_MS), NOW)).toBe("STALE");
  });

  it("is still STALE, not expired, well inside the TTL", () => {
    expect(snapshotFreshness(snap(6 * 60 * MINUTE), NOW)).toBe("STALE");
  });

  it("becomes EXPIRED at the TTL", () => {
    expect(snapshotFreshness(snap(SNAPSHOT_TTL_MS), NOW)).toBe("EXPIRED");
  });

  it("stays EXPIRED long afterwards", () => {
    expect(snapshotFreshness(snap(10 * SNAPSHOT_TTL_MS), NOW)).toBe("EXPIRED");
  });

  it("reports INCOMPATIBLE for a shape from an older build", () => {
    expect(snapshotFreshness(snap(MINUTE, 0), NOW)).toBe("INCOMPATIBLE");
  });

  it("reports INCOMPATIBLE rather than guessing at a corrupt date", () => {
    expect(
      snapshotFreshness(
        {
          snapshotVersion: CAREGIVER_SNAPSHOT_VERSION,
          generatedAt: "not-a-date",
          expiresAt: "also-not-a-date",
        },
        NOW,
      ),
    ).toBe("INCOMPATIBLE");
  });
});

describe("describeAge", () => {
  it("describes minutes", () => {
    expect(describeAge(snap(20 * MINUTE).generatedAt, NOW)).toBe("20 minutes ago");
  });

  it("uses the singular for one minute and one hour", () => {
    expect(describeAge(snap(MINUTE).generatedAt, NOW)).toBe("1 minute ago");
    expect(describeAge(snap(60 * MINUTE).generatedAt, NOW)).toBe("1 hour ago");
  });

  it("describes hours", () => {
    expect(describeAge(snap(5 * 60 * MINUTE).generatedAt, NOW)).toBe("5 hours ago");
  });

  it("goes vague past a day rather than implying precision", () => {
    expect(describeAge(snap(50 * 60 * MINUTE).generatedAt, NOW)).toBe(
      "more than a day ago",
    );
  });

  it("handles a snapshot taken moments ago", () => {
    expect(describeAge(snap(5000).generatedAt, NOW)).toBe(
      "less than a minute ago",
    );
  });

  it("does not throw on a corrupt date", () => {
    expect(describeAge("nonsense", NOW)).toBe("at an unknown time");
  });
});

describe("staleness wording", () => {
  it("always says the information was saved earlier", () => {
    for (const age of [MINUTE, SNAPSHOT_STALE_MS, 6 * 60 * MINUTE]) {
      const s = snap(age);
      const message = stalenessMessage(
        snapshotFreshness(s, NOW),
        s.generatedAt,
        NOW,
      );
      expect(message).toContain("saved earlier");
      expect(message).toContain("Last updated");
    }
  });

  it("adds an out-of-date warning once expired", () => {
    const s = snap(SNAPSHOT_TTL_MS + MINUTE);
    const message = stalenessMessage("EXPIRED", s.generatedAt, NOW);
    expect(message).toContain("may be out of date");
  });

  it("does not warn about being out of date while still within the TTL", () => {
    const s = snap(6 * 60 * MINUTE);
    expect(stalenessMessage("STALE", s.generatedAt, NOW)).not.toContain(
      "out of date",
    );
  });

  it("NEVER presents saved information as live", () => {
    // The one rule that makes a stale caregiver view safe at all.
    const forbidden = ["live", "right now", "real-time", "realtime", "current as of", "up to date"];
    for (const freshness of ["FRESH", "STALE", "EXPIRED", "INCOMPATIBLE"] as const) {
      const message = stalenessMessage(freshness, snap(MINUTE).generatedAt, NOW)
        .toLowerCase();
      for (const word of forbidden) {
        expect(message).not.toContain(word);
      }
    }
  });
});
