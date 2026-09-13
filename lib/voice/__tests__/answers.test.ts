import { describe, expect, it } from "vitest";

import { matchesAnswer, normaliseAnswer } from "@/lib/voice/answers";

describe("normaliseAnswer", () => {
  it("lowercases, trims punctuation and a leading article", () => {
    expect(normaliseAnswer("An Apple.")).toBe("apple");
    expect(normaliseAnswer("the  Boat")).toBe("boat");
  });
});

describe("matchesAnswer", () => {
  it("matches an exact spoken answer", () => {
    expect(matchesAnswer("apple", ["Apple"])).toBe(true);
  });

  it("matches with a leading article or filler words", () => {
    expect(matchesAnswer("an apple", ["Apple"])).toBe(true);
    expect(matchesAnswer("it is an apple", ["Apple"])).toBe(true);
  });

  it("matches any of several accepted labels", () => {
    expect(matchesAnswer("daughter", ["Priya", "Daughter"])).toBe(true);
  });

  it("rejects a wrong answer", () => {
    expect(matchesAnswer("banana", ["Apple"])).toBe(false);
    expect(matchesAnswer("", ["Apple"])).toBe(false);
  });

  it("does not match a partial word fragment", () => {
    // "app" should not match "apple" as a whole word
    expect(matchesAnswer("app", ["Apple"])).toBe(false);
  });
});
