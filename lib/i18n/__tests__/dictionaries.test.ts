import { describe, expect, it } from "vitest";

import { getDict, localeTag, LANGUAGES } from "@/lib/i18n/dictionaries";

/**
 * Localisation guarantees. English is the source of truth; Hindi and
 * Assamese must resolve every key (via fallback at minimum) and must
 * genuinely translate the elder-facing essentials — a key that quietly
 * fell back to English would be caught here rather than shipped.
 */

const en = getDict("EN");
const allKeys = Object.keys(en) as (keyof typeof en)[];

/** Elder-facing keys that MUST be really translated, not fall back. */
const REQUIRED_TRANSLATED: (keyof typeof en)[] = [
  "tagline",
  "start",
  "next",
  "back",
  "greetingMorning",
  "homeInvite",
  "journeyTitle",
  "gamesTitle",
  "chooseDifficulty",
  "memoriesTitle",
  "memoryActivityTitle",
  "profileVoice",
  "resultPlayAgain",
];

describe("dictionary completeness", () => {
  for (const { code } of LANGUAGES) {
    it(`${code} resolves every key to a non-empty string`, () => {
      const dict = getDict(code);
      for (const key of allKeys) {
        expect(typeof dict[key], `${code}.${String(key)}`).toBe("string");
        expect((dict[key] as string).length, `${code}.${String(key)}`).toBeGreaterThan(0);
      }
    });
  }
});

describe("required keys are genuinely translated", () => {
  for (const code of ["HI", "AS"] as const) {
    it(`${code} translates the elder-facing essentials`, () => {
      const dict = getDict(code);
      for (const key of REQUIRED_TRANSLATED) {
        expect(
          dict[key],
          `${code}.${String(key)} appears untranslated (equals English)`,
        ).not.toBe(en[key]);
      }
    });
  }
});

describe("locale tags", () => {
  it("maps each language to a BCP-47 tag", () => {
    expect(localeTag("EN")).toBe("en-IN");
    expect(localeTag("HI")).toBe("hi-IN");
    expect(localeTag("AS")).toBe("as-IN");
  });
});
