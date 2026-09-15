import { describe, expect, it } from "vitest";

import { checkCopy } from "@/lib/intelligence/safety";
import {
  getCaregiverDict,
  type CaregiverDict,
} from "@/lib/i18n/caregiver";

/**
 * WHAT THE CAREGIVER IS TOLD ABOUT MEMORY LANE.
 *
 * The retention screen is the single most misreadable thing Phase 8
 * added. It shows a list of somebody's memories with a status beside
 * each — which is exactly the shape of a clinical report, and is not
 * one. Every word on it therefore has to describe THE SCHEDULE.
 */

const LANGUAGES = ["EN", "HI", "AS"] as const;

const KEYS = [
  "navMemoryLane",
  "memoryLaneTitle",
  "memoryLaneHelp",
  "memoryLaneEmpty",
  "memoryLaneEmptyHelp",
  "memoryLaneNotEnabled",
  "memoryLaneNotMedical",
  "retentionNEW",
  "retentionLEARNING",
  "retentionBUILDING",
  "retentionHOLDING",
  "retentionNEEDS_REINFORCEMENT",
  "retentionNEWHelp",
  "retentionLEARNINGHelp",
  "retentionBUILDINGHelp",
  "retentionHOLDINGHelp",
  "retentionNEEDS_REINFORCEMENTHelp",
  "outcomeRECOGNISED",
  "outcomeASSISTED",
  "outcomeNOT_RECOGNISED",
  "outcomeSKIPPED",
  "memoryLaneNextDue",
  "memoryLaneDueNow",
  "memoryLaneNoHistory",
  "intervalSeconds",
  "intervalMinutes",
  "intervalOneMinute",
  "intervalDays",
  "intervalOneDay",
  "voiceTitle",
  "voiceHelp",
  "voiceRecord",
  "voiceStop",
  "voicePlay",
  "voiceDelete",
  "voiceReplace",
  "voiceNone",
  "voiceHas",
  "voiceUnsupported",
  "voiceDenied",
  "memoryEditTitle",
  "memoryNameField",
  "memoryRelationship",
  "memoryNoteOptional",
  "memoryPhotoOptional",
  "memoryPhotoHelp",
  "memoryAvailable",
  "memoryHidden",
  "memorySave",
  "memoryNoneYet",
  "memoryCatPERSON",
  "memoryCatPLACE",
  "memoryCatTHING",
  "memoryCatMOMENT",
  "errorImageType",
  "errorImageSize",
] as const satisfies readonly (keyof CaregiverDict)[];

describe("the caregiver Memory Lane vocabulary", () => {
  it("is present in every language", () => {
    for (const language of LANGUAGES) {
      const dict = getCaregiverDict(language);
      for (const key of KEYS) {
        expect(dict[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });

  it("does not leave Hindi or Assamese falling back to English", () => {
    const en = getCaregiverDict("EN");
    for (const language of ["HI", "AS"] as const) {
      const dict = getCaregiverDict(language);
      for (const key of KEYS) {
        expect(dict[key], `${language}.${key} is untranslated`).not.toBe(
          en[key],
        );
      }
    }
  });

  it("makes no medical claim, in any language", () => {
    for (const language of LANGUAGES) {
      const dict = getCaregiverDict(language);
      for (const key of KEYS) {
        // The disclaimer's whole job is to say "this is not a
        // measurement", so it is allowed to name the thing it denies.
        if (key === "memoryLaneNotMedical") continue;
        expect(checkCopy(dict[key]).violations, `${language}.${key}`).toEqual(
          [],
        );
      }
    }
  });

  it("states the disclaimer in every language", () => {
    for (const language of LANGUAGES) {
      expect(
        getCaregiverDict(language).memoryLaneNotMedical.length,
      ).toBeGreaterThan(40);
    }
  });

  it("describes what the app does, never what the person is", () => {
    const dict = getCaregiverDict("EN");
    // Every status explanation is about the schedule: what comes round
    // when. None of them is about a person's ability.
    for (const key of [
      "retentionLEARNINGHelp",
      "retentionBUILDINGHelp",
      "retentionHOLDINGHelp",
      "retentionNEEDS_REINFORCEMENTHelp",
    ] as const) {
      const text = dict[key].toLowerCase();
      // Word boundaries, not substrings: "the same sitting" contains
      // "he " and is perfectly fine.
      for (const banned of [
        /\bshe\b/,
        /\bhe\b/,
        /\bthey\b/,
        /\bcannot remember\b/,
        /\bforgot|forgetting\b/,
        /\bmemory loss\b/,
      ]) {
        expect(text, `${key} matches ${banned}`).not.toMatch(banned);
      }
    }
  });

  it("does not describe a miss as a failure", () => {
    for (const language of LANGUAGES) {
      const dict = getCaregiverDict(language);
      const outcomes = [
        dict.outcomeRECOGNISED,
        dict.outcomeASSISTED,
        dict.outcomeNOT_RECOGNISED,
        dict.outcomeSKIPPED,
      ]
        .join(" ")
        .toLowerCase();
      for (const word of ["fail", "wrong", "incorrect", "गलत", "ভুল", "বিফল"]) {
        expect(outcomes, `${language} outcome says "${word}"`).not.toContain(
          word,
        );
      }
    }
  });
});
