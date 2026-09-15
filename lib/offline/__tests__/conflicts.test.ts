import { describe, expect, it } from "vitest";

import {
  localShouldWin,
  resolveReminderConflict,
  type AckEvent,
} from "@/lib/offline/conflicts";

/**
 * The rule that protects a person's answer. Plain last-write-wins would
 * let a system-generated "missed" marker, or a stale snooze, quietly
 * erase a real "done" — these tests pin down that it cannot.
 */

const at = (iso: string) => new Date(iso);

const EARLY = at("2026-09-14T06:00:00Z");
const LATE = at("2026-09-14T09:00:00Z");

function event(status: AckEvent["status"], when: Date | null): AckEvent {
  return { status, at: when };
}

describe("one-sided cases", () => {
  it("takes the only side that has anything", () => {
    expect(resolveReminderConflict(event("DONE", LATE), null)).toMatchObject({
      winner: "local",
      status: "DONE",
      reason: "localOnly",
    });
    expect(resolveReminderConflict(null, event("SKIPPED", LATE))).toMatchObject({
      winner: "server",
      status: "SKIPPED",
      reason: "serverOnly",
    });
  });

  it("is a no-op when neither side has anything", () => {
    expect(resolveReminderConflict(null, null).status).toBe("PENDING");
  });
});

describe("a human answer beats a system marker", () => {
  it("keeps DONE over a later MISSED marker", () => {
    const resolution = resolveReminderConflict(
      event("DONE", EARLY),
      event("MISSED", LATE),
    );
    expect(resolution.winner).toBe("local");
    expect(resolution.status).toBe("DONE");
    expect(resolution.reason).toBe("humanBeatsSystem");
  });

  it("keeps a server DONE over a local MISSED marker", () => {
    const resolution = resolveReminderConflict(
      event("MISSED", LATE),
      event("DONE", EARLY),
    );
    expect(resolution.winner).toBe("server");
    expect(resolution.status).toBe("DONE");
  });

  it("beats PENDING too", () => {
    expect(
      resolveReminderConflict(event("SKIPPED", EARLY), event("PENDING", LATE))
        .status,
    ).toBe("SKIPPED");
  });
});

describe("a finished answer beats a postponement", () => {
  it("does not let an earlier snooze undo a later done", () => {
    const resolution = resolveReminderConflict(
      event("DONE", LATE),
      event("SNOOZED", EARLY),
    );
    expect(resolution.status).toBe("DONE");
    expect(resolution.reason).toBe("answerBeatsSnooze");
  });

  it("holds even when the snooze is the newer event", () => {
    const resolution = resolveReminderConflict(
      event("SNOOZED", LATE),
      event("DONE", EARLY),
    );
    expect(resolution.winner).toBe("server");
    expect(resolution.status).toBe("DONE");
  });
});

describe("between equals, the latest event wins", () => {
  it("prefers the later of two real answers", () => {
    expect(
      resolveReminderConflict(event("DONE", LATE), event("SKIPPED", EARLY)),
    ).toMatchObject({ winner: "local", status: "DONE", reason: "latestEvent" });

    expect(
      resolveReminderConflict(event("DONE", EARLY), event("SKIPPED", LATE)),
    ).toMatchObject({ winner: "server", status: "SKIPPED", reason: "latestEvent" });
  });
});

describe("determinism", () => {
  it("resolves a dead tie by fixed precedence, not by chance", () => {
    const a = resolveReminderConflict(
      event("SKIPPED", LATE),
      event("DONE", LATE),
    );
    const b = resolveReminderConflict(
      event("SKIPPED", LATE),
      event("DONE", LATE),
    );
    expect(a).toEqual(b);
    expect(a.status).toBe("DONE");
    expect(a.reason).toBe("statusPrecedence");
  });

  it("treats identical records as identical", () => {
    expect(
      resolveReminderConflict(event("DONE", LATE), event("DONE", LATE)).reason,
    ).toBe("identical");
  });

  it("converges: swapping the sides gives the same winning status", () => {
    const pairs: [AckEvent, AckEvent][] = [
      [event("DONE", EARLY), event("MISSED", LATE)],
      [event("SNOOZED", LATE), event("SKIPPED", EARLY)],
      [event("DONE", LATE), event("SKIPPED", EARLY)],
      [event("PENDING", LATE), event("DONE", EARLY)],
    ];
    for (const [local, server] of pairs) {
      const forward = resolveReminderConflict(local, server).status;
      const reversed = resolveReminderConflict(server, local).status;
      expect(reversed).toBe(forward);
    }
  });
});

describe("localShouldWin", () => {
  it("reports whether this device's answer should be pushed", () => {
    expect(localShouldWin(event("DONE", LATE), event("MISSED", LATE))).toBe(true);
    expect(localShouldWin(event("MISSED", LATE), event("DONE", EARLY))).toBe(
      false,
    );
  });
});
