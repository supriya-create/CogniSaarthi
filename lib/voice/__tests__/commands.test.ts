import { describe, expect, it } from "vitest";

import {
  COMMAND_ROUTE,
  normaliseTranscript,
  parseCommand,
} from "@/lib/voice/commands";

describe("normaliseTranscript", () => {
  it("lowercases, strips punctuation, collapses spaces", () => {
    expect(normaliseTranscript("  Start,  TODAY! ")).toBe("start today");
  });
});

describe("parseCommand — start activity", () => {
  for (const phrase of [
    "Start today's activity",
    "start activity",
    "Let's play",
    "begin",
    "start the journey please",
  ]) {
    it(`"${phrase}" → START_ACTIVITY`, () => {
      expect(parseCommand(phrase)).toBe("START_ACTIVITY");
    });
  }
});

describe("parseCommand — navigation", () => {
  it("recognises memories", () => {
    expect(parseCommand("open my memories")).toBe("OPEN_MEMORIES");
    expect(parseCommand("show me the photos")).toBe("OPEN_MEMORIES");
  });
  it("recognises games", () => {
    expect(parseCommand("open games")).toBe("OPEN_GAMES");
  });
  it("recognises home", () => {
    expect(parseCommand("go home")).toBe("GO_HOME");
    expect(parseCommand("take me back")).toBe("GO_HOME");
  });
  it("recognises profile", () => {
    expect(parseCommand("open my profile")).toBe("OPEN_PROFILE");
  });
});

describe("parseCommand — control", () => {
  it("recognises repeat", () => {
    expect(parseCommand("repeat that")).toBe("REPEAT");
    expect(parseCommand("say it again")).toBe("REPEAT");
  });
  it("recognises stop", () => {
    expect(parseCommand("stop")).toBe("STOP");
    expect(parseCommand("please cancel")).toBe("STOP");
  });
});

describe("parseCommand — precedence & multilingual", () => {
  it("prefers REPEAT over GAMES when both words appear", () => {
    expect(parseCommand("repeat the game")).toBe("REPEAT");
  });
  it("matches Hindi and Assamese keywords", () => {
    expect(parseCommand("शुरू करें")).toBe("START_ACTIVITY");
    expect(parseCommand("यादें दिखाओ")).toBe("OPEN_MEMORIES");
    expect(parseCommand("ঘৰলৈ যাওক")).toBe("GO_HOME");
  });
});

describe("parseCommand — unknown input", () => {
  it("returns null for gibberish and empty", () => {
    expect(parseCommand("the weather is nice today")).toBeNull();
    expect(parseCommand("")).toBeNull();
    expect(parseCommand("   ")).toBeNull();
  });
});

describe("command routes", () => {
  it("maps navigation commands to routes", () => {
    expect(COMMAND_ROUTE.OPEN_MEMORIES).toBe("/memories");
    expect(COMMAND_ROUTE.GO_HOME).toBe("/home");
    expect(COMMAND_ROUTE.OPEN_GAMES).toBe("/games");
    // Non-navigation commands have no route.
    expect(COMMAND_ROUTE.REPEAT).toBeUndefined();
    expect(COMMAND_ROUTE.STOP).toBeUndefined();
  });
});
