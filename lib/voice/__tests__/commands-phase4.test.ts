import { describe, expect, it } from "vitest";

import { COMMAND_ROUTE, parseCommand } from "@/lib/voice/commands";

/**
 * Phase 4 reminder voice commands. The set stays small and controlled —
 * navigation and reminder acknowledgement only. Sensitive data is never
 * modified by an open-ended phrase; MARK_DONE / REMIND_LATER act on the
 * reminder already in focus on the reminders screen.
 */

describe("reminder navigation commands", () => {
  it("opens reminders", () => {
    expect(parseCommand("open my reminders")).toBe("OPEN_REMINDERS");
    expect(COMMAND_ROUTE.OPEN_REMINDERS).toBe("/reminders");
  });
  it("shows the daily routine", () => {
    expect(parseCommand("show my day")).toBe("SHOW_TODAY");
    expect(parseCommand("open my routine")).toBe("SHOW_TODAY");
    expect(COMMAND_ROUTE.SHOW_TODAY).toBe("/routine");
  });
  it("reads reminders aloud", () => {
    expect(parseCommand("read my reminders")).toBe("READ_REMINDERS");
  });
});

describe("reminder acknowledgement commands", () => {
  it("marks done", () => {
    expect(parseCommand("mark as done")).toBe("MARK_DONE");
    expect(parseCommand("I did it")).toBe("MARK_DONE");
  });
  it("reminds later", () => {
    expect(parseCommand("remind me later")).toBe("REMIND_LATER");
    expect(parseCommand("not now")).toBe("REMIND_LATER");
  });
  it("does not route acknowledgement commands (they act in place)", () => {
    expect(COMMAND_ROUTE.MARK_DONE).toBeUndefined();
    expect(COMMAND_ROUTE.REMIND_LATER).toBeUndefined();
    expect(COMMAND_ROUTE.READ_REMINDERS).toBeUndefined();
  });
});

describe("caregiver alerts are never routed from the elder interface", () => {
  it("recognises OPEN_ALERTS but gives it no elder route", () => {
    expect(parseCommand("open alerts")).toBe("OPEN_ALERTS");
    expect(COMMAND_ROUTE.OPEN_ALERTS).toBeUndefined();
  });
});

describe("precedence with existing commands is preserved", () => {
  it("keeps memories, home and start working", () => {
    expect(parseCommand("open my memories")).toBe("OPEN_MEMORIES");
    expect(parseCommand("go home")).toBe("GO_HOME");
    expect(parseCommand("start today's activity")).toBe("START_ACTIVITY");
  });
});
