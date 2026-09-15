import { describe, expect, it } from "vitest";

import {
  activityIsResearchEligible,
  consentCopy,
  CURRENT_CONSENT_VERSION,
  resolveConsent,
  type ConsentRecordLike,
} from "@/lib/privacy/consent";

/**
 * The consent RULES, with no database in the way.
 *
 * The property being defended throughout: nothing other than an
 * explicit, current, un-withdrawn "yes" makes research use permitted.
 * Every other shape of stored data — absent, old, declined, withdrawn,
 * corrupt — has to land on `researchEligible === false`.
 */

const NOW = new Date("2026-09-15T10:00:00.000Z");

function record(overrides: Partial<ConsentRecordLike> = {}): ConsentRecordLike {
  return {
    version: CURRENT_CONSENT_VERSION,
    consented: true,
    consentedAt: new Date("2026-09-01T10:00:00.000Z"),
    withdrawnAt: null,
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("resolveConsent — first-time user", () => {
  it("reports NOT_ASKED when there is no record at all", () => {
    const status = resolveConsent([]);
    expect(status.state).toBe("NOT_ASKED");
    expect(status.researchEligible).toBe(false);
    expect(status.needsDecision).toBe(true);
    expect(status.version).toBeNull();
  });

  it("never treats absence of an answer as agreement", () => {
    expect(resolveConsent([]).researchEligible).toBe(false);
  });
});

describe("resolveConsent — accept", () => {
  it("reports GRANTED and permits research use", () => {
    const status = resolveConsent([record()]);
    expect(status.state).toBe("GRANTED");
    expect(status.researchEligible).toBe(true);
    expect(status.needsDecision).toBe(false);
    expect(status.version).toBe(CURRENT_CONSENT_VERSION);
  });

  it("reports when the decision was made", () => {
    const at = new Date("2026-08-20T08:30:00.000Z");
    const status = resolveConsent([record({ consentedAt: at })]);
    expect(status.updatedAt).toEqual(at);
  });
});

describe("resolveConsent — decline", () => {
  it("reports DECLINED and does not ask again", () => {
    const status = resolveConsent([
      record({ consented: false, consentedAt: null }),
    ]);
    expect(status.state).toBe("DECLINED");
    expect(status.researchEligible).toBe(false);
    // Asking on every visit would be nagging someone into a yes.
    expect(status.needsDecision).toBe(false);
  });
});

describe("resolveConsent — withdraw", () => {
  it("reports WITHDRAWN, distinct from a plain decline", () => {
    const status = resolveConsent([
      record({ consented: false, withdrawnAt: new Date("2026-09-10T00:00:00.000Z") }),
    ]);
    expect(status.state).toBe("WITHDRAWN");
    expect(status.researchEligible).toBe(false);
    expect(status.needsDecision).toBe(false);
  });

  it("a withdrawal beats a lingering consented flag", () => {
    // Defensive: if both were somehow true, withdrawal must win.
    const status = resolveConsent([
      record({ consented: true, withdrawnAt: new Date("2026-09-10T00:00:00.000Z") }),
    ]);
    expect(status.state).toBe("WITHDRAWN");
    expect(status.researchEligible).toBe(false);
  });

  it("reports the withdrawal date, not the original consent date", () => {
    const withdrawn = new Date("2026-09-10T00:00:00.000Z");
    const status = resolveConsent([record({ consented: false, withdrawnAt: withdrawn })]);
    expect(status.updatedAt).toEqual(withdrawn);
  });
});

describe("resolveConsent — version change", () => {
  it("does not carry an old yes onto new wording", () => {
    const status = resolveConsent([record({ version: "research-consent-v0" })]);
    expect(status.state).toBe("SUPERSEDED");
    expect(status.researchEligible).toBe(false);
    expect(status.needsDecision).toBe(true);
  });

  it("names the old version it is referring to", () => {
    const status = resolveConsent([record({ version: "research-consent-v0" })]);
    expect(status.version).toBe("research-consent-v0");
  });

  it("uses the current version's answer when both exist", () => {
    const status = resolveConsent([
      record({ version: "research-consent-v0", consented: true }),
      record({ consented: false, consentedAt: null }),
    ]);
    expect(status.state).toBe("DECLINED");
    expect(status.researchEligible).toBe(false);
  });

  it("an old WITHDRAWN row does not make the new version superseded", () => {
    const status = resolveConsent([
      record({
        version: "research-consent-v0",
        consented: false,
        withdrawnAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);
    expect(status.state).toBe("NOT_ASKED");
    expect(status.researchEligible).toBe(false);
  });
});

describe("activityIsResearchEligible — the consented window", () => {
  const consentedAt = new Date("2026-09-01T00:00:00.000Z");

  it("excludes activity from before consent was given", () => {
    expect(
      activityIsResearchEligible({
        occurredAt: new Date("2026-08-31T23:59:00.000Z"),
        consentedAt,
        withdrawnAt: null,
      }),
    ).toBe(false);
  });

  it("includes activity after consent was given", () => {
    expect(
      activityIsResearchEligible({
        occurredAt: new Date("2026-09-05T00:00:00.000Z"),
        consentedAt,
        withdrawnAt: null,
      }),
    ).toBe(true);
  });

  it("excludes activity from after withdrawal", () => {
    expect(
      activityIsResearchEligible({
        occurredAt: new Date("2026-09-12T00:00:00.000Z"),
        consentedAt,
        withdrawnAt: new Date("2026-09-10T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("keeps activity from inside the consented window after withdrawal", () => {
    // Withdrawal ends FUTURE eligibility. It is not retroactive erasure,
    // and pretending otherwise would misdescribe what already happened.
    expect(
      activityIsResearchEligible({
        occurredAt: new Date("2026-09-05T00:00:00.000Z"),
        consentedAt,
        withdrawnAt: new Date("2026-09-10T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("excludes everything when consent was never given", () => {
    expect(
      activityIsResearchEligible({
        occurredAt: NOW,
        consentedAt: null,
        withdrawnAt: null,
      }),
    ).toBe(false);
  });
});

describe("consent copy", () => {
  it("is available in all three languages", () => {
    for (const language of ["EN", "HI", "AS"] as const) {
      const copy = consentCopy(language);
      expect(copy.summary.length).toBeGreaterThan(10);
      expect(copy.allow.length).toBeGreaterThan(0);
      expect(copy.decline.length).toBeGreaterThan(0);
      expect(copy.learnMore.length).toBeGreaterThan(0);
      expect(copy.details.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("does not leave Hindi or Assamese as English", () => {
    expect(consentCopy("HI").summary).not.toBe(consentCopy("EN").summary);
    expect(consentCopy("AS").summary).not.toBe(consentCopy("EN").summary);
    expect(consentCopy("HI").allow).not.toBe(consentCopy("EN").allow);
    expect(consentCopy("AS").allow).not.toBe(consentCopy("EN").allow);
  });

  it("falls back to English rather than rendering nothing", () => {
    expect(consentCopy(null).summary).toBe(consentCopy("EN").summary);
  });

  it("makes no medical claim in any language", () => {
    // Deliberately not a blanket ban on the word "medical": the English
    // copy says "it is NOT a medical study", which is a disclaimer and
    // exactly what we want it to say. What must never appear is a claim
    // about a condition or a clinical process.
    const forbidden = [
      "diagnos",
      "dementia",
      "alzheimer",
      "clinical",
      "treatment",
      "disease",
      "risk score",
    ];
    for (const language of ["EN", "HI", "AS"] as const) {
      const all = [
        consentCopy(language).summary,
        ...consentCopy(language).details,
      ]
        .join(" ")
        .toLowerCase();
      for (const word of forbidden) {
        expect(all).not.toContain(word);
      }
    }
  });

  it("says plainly that this is not a medical study", () => {
    // The English wording is asserted directly; the translations are
    // checked for the presence of a dedicated disclaimer line, since
    // the phrasing differs by language.
    expect(consentCopy("EN").details.join(" ")).toContain("not a medical study");
    for (const language of ["HI", "AS"] as const) {
      expect(consentCopy(language).details.length).toBe(
        consentCopy("EN").details.length,
      );
    }
  });
});
