import { describe, expect, it } from "vitest";

import { buildMemoryRounds, type MemoryItem } from "@/lib/memories/activity";
import { matchesAnswer } from "@/lib/voice/answers";

function person(
  id: string,
  title: string,
  relationship: string | null = null,
  hasImage = true,
): MemoryItem {
  return { id, category: "PERSON", title, relationship, hasImage };
}

describe("buildMemoryRounds", () => {
  it("excludes memories without a photo", () => {
    const rounds = buildMemoryRounds([
      person("a", "Priya", "Daughter", true),
      person("b", "Raj", "Son", false),
    ]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].memoryId).toBe("a");
  });

  it("returns no rounds when there are no photos (missing metadata)", () => {
    const rounds = buildMemoryRounds([person("a", "Priya", "Daughter", false)]);
    expect(rounds).toHaveLength(0);
  });

  it("always includes the correct answer among the options", () => {
    const rounds = buildMemoryRounds([
      person("a", "Priya", "Daughter"),
      person("b", "Raj", "Son"),
      person("c", "Mina", "Sister"),
    ]);
    for (const round of rounds) {
      expect(round.options.some((o) => o.id === round.memoryId)).toBe(true);
      expect(round.options.length).toBeGreaterThanOrEqual(2);
      // options are unique by label
      const labels = round.options.map((o) => o.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("tops up options with filler when there are too few memories", () => {
    const rounds = buildMemoryRounds([person("a", "Priya", "Daughter")]);
    expect(rounds).toHaveLength(1);
    // one real + filler distractors → at least 2 options
    expect(rounds[0].options.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts the name or the relationship as a spoken answer", () => {
    const [round] = buildMemoryRounds([person("a", "Priya", "Daughter")]);
    expect(round.acceptedAnswers).toContain("Priya");
    expect(round.acceptedAnswers).toContain("Daughter");
    expect(matchesAnswer("it is my daughter", round.acceptedAnswers)).toBe(true);
    expect(matchesAnswer("Priya", round.acceptedAnswers)).toBe(true);
    expect(matchesAnswer("someone else", round.acceptedAnswers)).toBe(false);
  });

  it("uses the right prompt for each category", () => {
    const [p] = buildMemoryRounds([person("a", "Priya")]);
    expect(p.promptKey).toBe("memoryWhoIsThis");
    const [pl] = buildMemoryRounds([
      { id: "x", category: "PLACE", title: "The garden", relationship: null, hasImage: true },
    ]);
    expect(pl.promptKey).toBe("memoryWhatPlace");
  });
});
