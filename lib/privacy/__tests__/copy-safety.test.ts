import { describe, expect, it } from "vitest";
import type { Language } from "@prisma/client";

import { checkCopy } from "@/lib/intelligence/safety";
import { getDict } from "@/lib/i18n/dictionaries";
import { consentCopy } from "@/lib/privacy/consent";
import {
  stalenessMessage,
  type SnapshotFreshness,
} from "@/lib/caregiver/snapshot-types";
import { DEFAULT_RETENTION } from "@/lib/privacy/retention";

/**
 * NO MEDICAL CLAIMS — applied to everything Phase 7 added.
 *
 * Phase 6's safety guard governed the intelligence layer's generated
 * copy. Consent text is at least as sensitive: it is the one screen
 * where a person is asked to agree to something, and an implication
 * that their data is going somewhere clinical would make that consent
 * misinformed even if every other word were true.
 *
 * The guard is applied here to the privacy dictionary keys, the consent
 * copy in all three languages, and the caregiver staleness wording.
 */

const LANGUAGES: Language[] = ["EN", "HI", "AS"];

/** Every Phase 7 key on the elder-facing privacy surface. */
const PRIVACY_KEYS = [
  "privacyTitle",
  "privacyNav",
  "privacyIntro",
  "privacyResearchHeading",
  "privacyStatusLabel",
  "privacyStatusGranted",
  "privacyStatusDeclined",
  "privacyStatusWithdrawn",
  "privacyStatusNotAsked",
  "privacyStatusSuperseded",
  "privacyWithdraw",
  "privacyAllowAgain",
  "privacyChangeAnyTime",
  "privacyLastUpdated",
  "privacyNothingElseChanges",
  "privacyKeepsHeading",
  "privacyKeepsActivities",
  "privacyKeepsMemories",
  "privacyKeepsReminders",
  "privacyNotMedical",
  "privacySaving",
  "privacySaveError",
] as const;

describe("privacy dictionary", () => {
  it("has every Phase 7 key translated in all three languages", () => {
    for (const language of LANGUAGES) {
      const dict = getDict(language);
      for (const key of PRIVACY_KEYS) {
        expect(dict[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });

  it("does not leave Hindi or Assamese falling back to English", () => {
    const en = getDict("EN");
    for (const language of ["HI", "AS"] as const) {
      const dict = getDict(language);
      for (const key of PRIVACY_KEYS) {
        expect(dict[key], `${language}.${key} is untranslated`).not.toBe(
          en[key],
        );
      }
    }
  });

  it("makes no forbidden claim in any language", () => {
    for (const language of LANGUAGES) {
      const dict = getDict(language);
      for (const key of PRIVACY_KEYS) {
        // `privacyNotMedical` is the deliberate disclaimer and is
        // checked separately — a sentence whose job is to say "this is
        // not a medical service" has to be allowed to say so.
        if (key === "privacyNotMedical") continue;
        const result = checkCopy(dict[key]);
        expect(result.violations, `${language}.${key}`).toEqual([]);
      }
    }
  });

  it("states the non-medical disclaimer in every language", () => {
    for (const language of LANGUAGES) {
      expect(getDict(language).privacyNotMedical.length).toBeGreaterThan(20);
    }
  });
});

describe("consent copy", () => {
  it("claims nothing clinical in any language", () => {
    for (const language of LANGUAGES) {
      const copy = consentCopy(language);
      // The English detail line says "not a medical study", which the
      // blunt guard would not trip on, and which must stay.
      for (const text of [copy.summary, copy.allow, copy.decline, copy.learnMore]) {
        expect(checkCopy(text).violations, `${language}: ${text}`).toEqual([]);
      }
    }
  });

  it("does not describe the purpose as research on a condition", () => {
    for (const language of LANGUAGES) {
      const all = [consentCopy(language).summary, ...consentCopy(language).details]
        .join(" ")
        .toLowerCase();
      expect(all).not.toContain("dementia");
      expect(all).not.toContain("alzheimer");
      expect(all).not.toContain("diagnos");
    }
  });
});

describe("caregiver staleness wording", () => {
  it("claims nothing clinical", () => {
    const freshnesses: SnapshotFreshness[] = [
      "FRESH",
      "STALE",
      "EXPIRED",
      "INCOMPATIBLE",
    ];
    for (const freshness of freshnesses) {
      const message = stalenessMessage(
        freshness,
        new Date().toISOString(),
      );
      expect(checkCopy(message).violations).toEqual([]);
    }
  });
});

describe("retention policy prose", () => {
  it("claims no legal requirement it cannot support", () => {
    // The periods are product choices. Saying "as required by law"
    // would be a fiction, so the word must not appear.
    for (const rule of DEFAULT_RETENTION) {
      const text = `${rule.purpose} ${rule.rationale}`.toLowerCase();
      expect(text).not.toContain("required by law");
      expect(text).not.toContain("legally required");
      expect(text).not.toContain("statutory");
    }
  });

  it("makes no medical claim about why data is kept", () => {
    for (const rule of DEFAULT_RETENTION) {
      expect(
        checkCopy(`${rule.purpose} ${rule.rationale}`).violations,
        rule.category,
      ).toEqual([]);
    }
  });
});
