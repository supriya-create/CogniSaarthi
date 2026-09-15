import type { Language } from "@prisma/client";

/**
 * PRIVACY — the consent model.
 * -----------------------------------------------------------------
 * Pure, dependency-free definitions of WHAT is being asked and HOW a
 * stored answer is interpreted. No Prisma import, so every rule below
 * is unit-testable without a database (the database side lives in
 * `server.ts`).
 *
 * Three ideas hold this together:
 *
 *  1. Consent is to a VERSION of a specific explanation, never to an
 *     abstract idea of "research". A stored `version` identifies the
 *     exact words the person saw.
 *  2. A consent to v1 does NOT cover v2. If the purpose changes
 *     materially the answer is unknown again, and the person is asked
 *     once more rather than carried forward.
 *  3. "Not asked", "declined" and "withdrawn" are three different
 *     states. Collapsing them into a boolean would make it impossible
 *     to tell someone who said no from someone who was never offered
 *     the choice.
 */

/** The identifier stored on every consent row. Bump for new wording. */
export const CURRENT_CONSENT_VERSION = "research-consent-v1";

/**
 * Every version that has ever existed, newest last. Old entries are
 * kept so a historical answer can still be explained to the person who
 * gave it — "you agreed to this text, on this date".
 */
export const CONSENT_VERSIONS = [CURRENT_CONSENT_VERSION] as const;

export type ConsentVersion = (typeof CONSENT_VERSIONS)[number];

/**
 * A stored answer, as the rest of the app sees it.
 *
 * NOT_ASKED  — no row for the current version.
 * GRANTED    — agreed to the current version and has not withdrawn.
 * DECLINED   — was asked and said no ("Not now").
 * WITHDRAWN  — agreed once, then withdrew.
 * SUPERSEDED — agreed to an older version only; the wording has since
 *              changed materially, so the answer no longer applies.
 */
export type ConsentState =
  | "NOT_ASKED"
  | "GRANTED"
  | "DECLINED"
  | "WITHDRAWN"
  | "SUPERSEDED";

/** The minimum a stored row must expose for the rules below. */
export interface ConsentRecordLike {
  version: string;
  consented: boolean;
  consentedAt: Date | null;
  withdrawnAt: Date | null;
  updatedAt: Date;
}

export interface ConsentStatus {
  state: ConsentState;
  /** The version the state refers to, when there is a row. */
  version: string | null;
  /** When the current answer was given or changed. */
  updatedAt: Date | null;
  /** True only when research use is permitted right now. */
  researchEligible: boolean;
  /** True when the person should be shown the question. */
  needsDecision: boolean;
}

const NOT_ASKED: ConsentStatus = {
  state: "NOT_ASKED",
  version: null,
  updatedAt: null,
  researchEligible: false,
  needsDecision: true,
};

/**
 * Interpret a person's consent rows.
 *
 * The rule is conservative on purpose: anything other than an explicit,
 * current, un-withdrawn "yes" means research use is NOT permitted. A
 * missing row, an unreadable row and an old row all land on the same
 * safe side.
 */
export function resolveConsent(
  records: ConsentRecordLike[],
  currentVersion: string = CURRENT_CONSENT_VERSION,
): ConsentStatus {
  const current = records.find((r) => r.version === currentVersion);

  if (current) {
    if (current.withdrawnAt !== null) {
      return {
        state: "WITHDRAWN",
        version: current.version,
        updatedAt: current.withdrawnAt,
        researchEligible: false,
        // Withdrawal is a decision. Asking again straight away would be
        // nagging someone into changing their mind.
        needsDecision: false,
      };
    }

    if (current.consented) {
      return {
        state: "GRANTED",
        version: current.version,
        updatedAt: current.consentedAt ?? current.updatedAt,
        researchEligible: true,
        needsDecision: false,
      };
    }

    return {
      state: "DECLINED",
      version: current.version,
      updatedAt: current.updatedAt,
      researchEligible: false,
      needsDecision: false,
    };
  }

  // No answer for the current wording. If they agreed to older wording,
  // say so honestly rather than treating it as a yes.
  const staleGrant = records.find(
    (r) => r.consented && r.withdrawnAt === null && r.version !== currentVersion,
  );

  if (staleGrant) {
    return {
      state: "SUPERSEDED",
      version: staleGrant.version,
      updatedAt: staleGrant.consentedAt ?? staleGrant.updatedAt,
      researchEligible: false,
      needsDecision: true,
    };
  }

  return NOT_ASKED;
}

/**
 * Whether one activity record may appear in a research export.
 *
 * Consent is not retroactive and not perpetual. Activity is eligible
 * only if it happened inside a window the person had actually agreed
 * to — so withdrawing stops FUTURE activity from being included while
 * leaving the ordinary product history untouched.
 */
export function activityIsResearchEligible(input: {
  occurredAt: Date;
  consentedAt: Date | null;
  withdrawnAt: Date | null;
}): boolean {
  if (input.consentedAt === null) return false;
  if (input.occurredAt < input.consentedAt) return false;
  if (input.withdrawnAt !== null && input.occurredAt >= input.withdrawnAt) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------
// The words themselves
// ---------------------------------------------------------------

/**
 * The consent copy, in all three languages.
 *
 * Kept HERE rather than in `dictionaries.ts` because these strings are
 * not interface chrome — they are the thing being agreed to. Their
 * version identifier and their text have to travel together, and a
 * translation that drifts from the English would mean a Hindi-speaking
 * person agreed to something different from what was recorded.
 *
 * `summary` is the whole question. `details` is the longer explanation
 * behind "Learn more", never the primary interface.
 */
export interface ConsentCopy {
  summary: string;
  allow: string;
  decline: string;
  learnMore: string;
  details: string[];
}

const COPY: Record<Language, ConsentCopy> = {
  EN: {
    summary:
      "Would you like to allow your activity data to help improve Cognisaarthi?",
    allow: "Allow",
    decline: "Not now",
    learnMore: "Learn more",
    details: [
      "If you allow this, we use how your activities went — scores, how long they took, which activity it was — to improve Cognisaarthi.",
      "Your name, your photos, your memories and your reminders are never included.",
      "Your information is not linked to your name. It is grouped with other people's.",
      "This is for improving the app. It is not a medical study and no doctor sees it.",
      "You can change your mind at any time. Nothing else in the app changes either way.",
    ],
  },
  HI: {
    summary:
      "क्या आप अपनी गतिविधियों की जानकारी से कॉग्निसारथी को बेहतर बनाने की अनुमति देना चाहेंगे?",
    allow: "अनुमति दें",
    decline: "अभी नहीं",
    learnMore: "और जानें",
    details: [
      "अनुमति देने पर हम यह देखते हैं कि आपकी गतिविधियाँ कैसी रहीं — अंक, कितना समय लगा, कौन सी गतिविधि थी — ताकि कॉग्निसारथी बेहतर बन सके।",
      "आपका नाम, आपकी तस्वीरें, आपकी यादें और आपके रिमाइंडर कभी शामिल नहीं किए जाते।",
      "आपकी जानकारी आपके नाम से नहीं जुड़ी होती। वह दूसरों की जानकारी के साथ मिलाकर देखी जाती है।",
      "यह ऐप को बेहतर बनाने के लिए है। यह कोई चिकित्सा अध्ययन नहीं है और कोई डॉक्टर इसे नहीं देखता।",
      "आप कभी भी अपना मन बदल सकते हैं। ऐप में और कुछ नहीं बदलेगा।",
    ],
  },
  AS: {
    summary:
      "কগনিসাৰথীক উন্নত কৰাত সহায় কৰিবলৈ আপোনাৰ কামৰ তথ্য ব্যৱহাৰ কৰিবলৈ অনুমতি দিব বিচাৰেনে?",
    allow: "অনুমতি দিয়ক",
    decline: "এতিয়া নহয়",
    learnMore: "অধিক জানক",
    details: [
      "অনুমতি দিলে আমি চাওঁ আপোনাৰ কামবোৰ কেনেকৈ হ'ল — নম্বৰ, কিমান সময় লাগিল, কোনটো কাম আছিল — যাতে কগনিসাৰথী উন্নত হয়।",
      "আপোনাৰ নাম, আপোনাৰ ফটো, আপোনাৰ স্মৃতি আৰু আপোনাৰ মনত পেলোৱাবোৰ কেতিয়াও অন্তৰ্ভুক্ত কৰা নহয়।",
      "আপোনাৰ তথ্য আপোনাৰ নামৰ সৈতে সংযুক্ত নহয়। ই আন লোকৰ তথ্যৰ সৈতে একেলগে ৰখা হয়।",
      "এইটো এপটো উন্নত কৰাৰ বাবে। এইটো কোনো চিকিৎসা অধ্যয়ন নহয় আৰু কোনো ডাক্তৰে ইয়াক নাচায়।",
      "আপুনি যিকোনো সময়তে মন সলনি কৰিব পাৰে। এপটোত আন একো সলনি নহয়।",
    ],
  },
};

export function consentCopy(language: Language | null | undefined): ConsentCopy {
  return COPY[language ?? "EN"] ?? COPY.EN;
}
