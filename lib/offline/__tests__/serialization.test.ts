import { describe, expect, it } from "vitest";

import {
  fromIso,
  newId,
  occurrenceKey,
  toIso,
  toStorablePayload,
} from "@/lib/offline/serialization";

describe("dates cross the boundary as ISO", () => {
  it("converts both directions", () => {
    const date = new Date("2026-09-14T02:30:00.000Z");
    expect(toIso(date)).toBe("2026-09-14T02:30:00.000Z");
    expect(fromIso("2026-09-14T02:30:00.000Z")?.getTime()).toBe(date.getTime());
  });

  it("refuses nonsense rather than storing it", () => {
    expect(toIso(new Date("not a date"))).toBeNull();
    expect(toIso(null)).toBeNull();
    expect(fromIso("rubbish")).toBeNull();
    expect(fromIso(null)).toBeNull();
  });
});

describe("toStorablePayload keeps only plain data", () => {
  it("strips functions — the queue never stores executable code", () => {
    const payload = toStorablePayload({
      title: "Morning medication",
      // Something that must never survive into the queue.
      evil: () => "run me",
      nested: { alsoEvil: function () { return 1; } },
    }) as Record<string, unknown>;

    expect(payload.title).toBe("Morning medication");
    // The key is dropped entirely rather than kept as an empty value.
    expect(payload).not.toHaveProperty("evil");
    expect(payload.nested).not.toHaveProperty("alsoEvil");
    expect(typeof payload.evil).not.toBe("function");
  });

  it("flattens dates and keeps primitives", () => {
    const payload = toStorablePayload({
      when: new Date("2026-09-14T02:30:00.000Z"),
      count: 3,
      ok: true,
      nothing: null,
    }) as Record<string, unknown>;

    expect(payload.when).toBe("2026-09-14T02:30:00.000Z");
    expect(payload.count).toBe(3);
    expect(payload.ok).toBe(true);
    expect(payload.nothing).toBeNull();
  });

  it("keeps arrays of round telemetry intact", () => {
    const rounds = [
      { index: 0, correct: 3, total: 3, mistakes: 0, hintsUsed: 0, responseTimeMs: 900 },
    ];
    expect(toStorablePayload({ rounds })).toEqual({ rounds });
  });

  it("survives a cycle instead of throwing", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    expect(() => toStorablePayload(cyclic)).not.toThrow();
    expect((toStorablePayload(cyclic) as Record<string, unknown>).name).toBe("x");
  });

  it("drops non-finite numbers rather than storing NaN", () => {
    const payload = toStorablePayload({ a: NaN, b: Infinity, c: 5 }) as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("a");
    expect(payload).not.toHaveProperty("b");
    expect(payload.c).toBe(5);
  });

  it("keeps an explicit null, which is real data", () => {
    const payload = toStorablePayload({ snoozedUntil: null }) as Record<
      string,
      unknown
    >;
    expect(payload).toHaveProperty("snoozedUntil");
    expect(payload.snoozedUntil).toBeNull();
  });
});

describe("identifiers", () => {
  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });

  it("keys an occurrence by reminder and instant", () => {
    const key = occurrenceKey("rem1", new Date("2026-09-14T02:30:00.000Z"));
    expect(key).toBe("rem1|2026-09-14T02:30:00.000Z");
    // A string instant normalises to exactly the same key, so the same
    // occurrence is never stored twice under two spellings.
    expect(occurrenceKey("rem1", "2026-09-14T02:30:00.000Z")).toBe(key);
  });
});
