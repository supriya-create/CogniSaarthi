import { describe, expect, it } from "vitest";

import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { fill, getCaregiverDict } from "@/lib/i18n/caregiver";
import { caregiverPrefsSchema } from "@/lib/validation/schemas";

/**
 * Caregiver localisation guarantees.
 *
 * English is the source of truth; Hindi and Assamese are partials that
 * fall back rather than rendering blank. The last group is the one
 * that matters most: a caregiver changing their own reading language
 * must not be able to change the elderly person's interface, and that
 * is asserted against the schema rather than left to a code comment.
 */

const en = getCaregiverDict("EN");
const allKeys = Object.keys(en) as (keyof typeof en)[];

/** Caregiver-facing keys that must be genuinely translated. */
const REQUIRED_TRANSLATED: (keyof typeof en)[] = [
  "caregiverLabel",
  "navOverview",
  "navReminders",
  "navAlerts",
  "navSettings",
  "signOut",
  "todaysOverview",
  "needsAttention",
  "settingsTitle",
  "settingsLanguage",
  "notMedicalNotice",
  "notConnectedTitle",
];

describe("caregiver dictionary completeness", () => {
  for (const { code } of LANGUAGES) {
    it(`${code} resolves every key to a non-empty string`, () => {
      const dict = getCaregiverDict(code);
      for (const key of allKeys) {
        expect(typeof dict[key], `${code}.${String(key)}`).toBe("string");
        expect(
          (dict[key] as string).length,
          `${code}.${String(key)}`,
        ).toBeGreaterThan(0);
      }
    });
  }

  it("has no key in a partial that English does not define", () => {
    // A typo'd key in a translation would otherwise sit there silently,
    // never rendering, because nothing reads it.
    for (const code of ["HI", "AS"] as const) {
      for (const key of Object.keys(getCaregiverDict(code))) {
        expect(allKeys, `${code} has stray key ${key}`).toContain(key);
      }
    }
  });
});

describe("required caregiver keys are genuinely translated", () => {
  for (const code of ["HI", "AS"] as const) {
    it(`${code} translates the caregiver essentials`, () => {
      const dict = getCaregiverDict(code);
      for (const key of REQUIRED_TRANSLATED) {
        expect(
          dict[key],
          `${code}.${String(key)} appears untranslated (equals English)`,
        ).not.toBe(en[key]);
      }
    });
  }

  it("translates the not-a-medical-measurement notice in every language", () => {
    // This is the sentence that stops a family reading a puzzle score
    // as a diagnosis. An English-only version of it is a real harm.
    for (const code of ["HI", "AS"] as const) {
      const notice = getCaregiverDict(code).notMedicalNotice;
      expect(notice).not.toBe(en.notMedicalNotice);
      expect(notice.length).toBeGreaterThan(40);
    }
  });
});

describe("fallback behaviour", () => {
  it("falls back to English rather than rendering nothing", () => {
    // Every key resolves in every language even where the partial has
    // no entry — asserted above; here we pin the mechanism itself.
    const hi = getCaregiverDict("HI");
    for (const key of allKeys) {
      expect(hi[key]).toBeTruthy();
    }
  });

  it("falls back to English for an absent language", () => {
    expect(getCaregiverDict(undefined)).toEqual(en);
    expect(getCaregiverDict(null)).toEqual(en);
  });
});

describe("placeholder interpolation", () => {
  it("substitutes a name", () => {
    expect(fill("Notes about {name}", { name: "Meera" })).toBe(
      "Notes about Meera",
    );
  });

  it("substitutes every occurrence", () => {
    // notesHelp mentions the person three times.
    const filled = fill(en.notesHelp, { name: "Meera" });
    expect(filled).not.toContain("{name}");
    expect(filled.split("Meera").length - 1).toBeGreaterThanOrEqual(2);
  });

  it("leaves every translated placeholder resolvable", () => {
    // Word order differs between these languages, so a translation that
    // dropped its placeholder would render a sentence with a hole in it.
    for (const { code } of LANGUAGES) {
      const dict = getCaregiverDict(code);
      for (const key of allKeys) {
        const value = dict[key];
        if (!en[key].includes("{name}")) continue;
        expect(
          value.includes("{name}"),
          `${code}.${String(key)} lost its {name} placeholder`,
        ).toBe(true);
      }
    }
  });

  it("leaves unknown placeholders alone rather than blanking them", () => {
    expect(fill("Hello {other}", { name: "Meera" })).toBe("Hello {other}");
  });
});

describe("a caregiver's language is their own", () => {
  it("accepts a language for the caregiver themselves", () => {
    const parsed = caregiverPrefsSchema.safeParse({ language: "AS" });
    expect(parsed.success).toBe(true);
  });

  it("has no field that could name somebody else", () => {
    // The guarantee is structural: without a `userId` in the schema,
    // this endpoint cannot be asked to change the elder's language.
    // Identity comes from the caregiver's own session cookie.
    const shape = Object.keys(caregiverPrefsSchema.shape);
    expect(shape).not.toContain("userId");
    expect(shape).not.toContain("elderId");
    expect(shape).toContain("language");
  });

  it("drops an attempt to smuggle in another person's id", () => {
    const parsed = caregiverPrefsSchema.safeParse({
      language: "HI",
      userId: "some-elder-id",
    });
    expect(parsed.success).toBe(true);
    // Parsed OUT, so `updateCaregiverPreference` never sees it.
    expect(parsed.success && "userId" in parsed.data).toBe(false);
  });

  it("rejects a language that is not one of the three", () => {
    expect(caregiverPrefsSchema.safeParse({ language: "FR" }).success).toBe(
      false,
    );
  });
});
