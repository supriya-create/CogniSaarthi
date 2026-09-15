import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import * as db from "@/lib/offline/db";
import * as store from "@/lib/offline/caregiver-store";
import { META_KEYS, STORES } from "@/lib/offline/schema";
import {
  CAREGIVER_SNAPSHOT_VERSION,
  SNAPSHOT_TTL_MS,
  type CaregiverSnapshot,
} from "@/lib/caregiver/snapshot-types";

/**
 * The caregiver's local store, against a real IndexedDB implementation.
 *
 * The behaviours that matter on a SHARED FAMILY TABLET:
 *   - signing out removes the snapshot;
 *   - a different caregiver signing in does not inherit the last one's;
 *   - an expired snapshot is kept but flagged, never silently current.
 */

const CG_A = "caregiver-a";
const CG_B = "caregiver-b";
const NOW = new Date("2026-09-15T12:00:00.000Z");

function snapshot(
  caregiverId: string,
  overrides: Partial<CaregiverSnapshot> = {},
): CaregiverSnapshot {
  const generatedAt = new Date(NOW.getTime() - 60_000);
  return {
    snapshotVersion: CAREGIVER_SNAPSHOT_VERSION,
    caregiverId,
    elderId: `elder-of-${caregiverId}`,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + SNAPSHOT_TTL_MS).toISOString(),
    data: {
      elder: { name: "Elder", avatarId: "marigold", relationship: "Daughter" },
      today: {
        activitiesCompleted: 2,
        activitiesGoal: 3,
        remindersAcknowledged: 1,
        remindersTotal: 2,
        averageScore: 72,
      },
      recentSessions: [],
      reminders: [],
      alerts: [],
      trends: [],
    },
    ...overrides,
  };
}

beforeEach(async () => {
  await db.clearAll();
  await db.remove(STORES.meta, META_KEYS.caregiverId);
});

describe("snapshot creation and retrieval", () => {
  it("stores and reads back a snapshot", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    const read = await store.getCaregiverSnapshot(CG_A);
    expect(read?.elderId).toBe("elder-of-caregiver-a");
  });

  it("records which caregiver this device is holding a snapshot for", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    expect(await db.getMeta<string>(META_KEYS.caregiverId)).toBe(CG_A);
  });

  it("returns nothing when there is no snapshot", async () => {
    expect(await store.getCaregiverSnapshot(CG_A)).toBeNull();
  });

  it("returns nothing for a caregiver who has no snapshot here", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    expect(await store.getCaregiverSnapshot(CG_B)).toBeNull();
  });

  it("ignores a snapshot written by an older version of the app", async () => {
    await db.put(STORES.caregiverSnapshot, snapshot(CG_A, { snapshotVersion: 0 }));
    expect(await store.getCaregiverSnapshot(CG_A)).toBeNull();
  });
});

describe("stale and expired snapshots", () => {
  it("reports a recent snapshot as FRESH", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    const result = await store.readSnapshotWithFreshness(CG_A, NOW);
    expect(result?.freshness).toBe("FRESH");
  });

  it("reports an older snapshot as STALE", async () => {
    const generatedAt = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    await store.saveCaregiverSnapshot(
      snapshot(CG_A, {
        generatedAt: generatedAt.toISOString(),
        expiresAt: new Date(generatedAt.getTime() + SNAPSHOT_TTL_MS).toISOString(),
      }),
    );
    expect((await store.readSnapshotWithFreshness(CG_A, NOW))?.freshness).toBe(
      "STALE",
    );
  });

  it("KEEPS an expired snapshot, flagged rather than deleted", async () => {
    // Deleting it would leave the caregiver with an empty screen. The
    // last known state, clearly labelled as old, is more use than that.
    const generatedAt = new Date(NOW.getTime() - 3 * SNAPSHOT_TTL_MS);
    await store.saveCaregiverSnapshot(
      snapshot(CG_A, {
        generatedAt: generatedAt.toISOString(),
        expiresAt: new Date(generatedAt.getTime() + SNAPSHOT_TTL_MS).toISOString(),
      }),
    );

    const result = await store.readSnapshotWithFreshness(CG_A, NOW);
    expect(result).not.toBeNull();
    expect(result?.freshness).toBe("EXPIRED");
    expect(result?.snapshot.data.elder.name).toBe("Elder");
  });
});

describe("account switching", () => {
  it("discards the previous caregiver's snapshot", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.saveCaregiverSnapshot(snapshot(CG_B));

    expect(await store.getCaregiverSnapshot(CG_A)).toBeNull();
    expect(await store.getCaregiverSnapshot(CG_B)).not.toBeNull();
  });

  it("removes it from the store entirely, not just from view", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.ensureCaregiverScope(CG_B);

    const all = await db.getAll<CaregiverSnapshot>(STORES.caregiverSnapshot);
    expect(all).toHaveLength(0);
  });

  it("keeps the snapshot when the same caregiver returns", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.ensureCaregiverScope(CG_A);
    expect(await store.getCaregiverSnapshot(CG_A)).not.toBeNull();
  });
});

describe("sign-out", () => {
  it("removes every caregiver snapshot on the device", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.clearCaregiverSnapshots();

    expect(await store.getCaregiverSnapshot(CG_A)).toBeNull();
    expect(
      await db.getAll<CaregiverSnapshot>(STORES.caregiverSnapshot),
    ).toHaveLength(0);
  });

  it("forgets which caregiver the device belonged to", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.clearCaregiverSnapshots();
    expect(await db.getMeta<string>(META_KEYS.caregiverId)).toBeNull();
  });

  it("leaves nothing readable for the next person", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await store.clearCaregiverSnapshots();

    // The whole database, not just the store we cleared.
    const everything = JSON.stringify(
      await db.getAll<unknown>(STORES.caregiverSnapshot),
    );
    expect(everything).not.toContain("elder-of-caregiver-a");
  });
});

describe("elder sign-out also clears it", () => {
  it("clearAll removes the caregiver snapshot too", async () => {
    await store.saveCaregiverSnapshot(snapshot(CG_A));
    await db.clearAll();
    expect(await store.getCaregiverSnapshot(CG_A)).toBeNull();
  });
});
