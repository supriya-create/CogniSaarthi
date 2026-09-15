/**
 * THE MEDICAL BOUNDARY, ENFORCED IN CODE.
 * -----------------------------------------------------------------
 * Cognisaarthi is a cognitive ASSISTANCE and personalisation platform.
 * It is not a diagnostic system, and nothing it generates may imply
 * otherwise — not in a caregiver insight, and certainly not in anything
 * an elderly person reads about themselves.
 *
 * Every phrase below is banned from generated copy. The list is applied
 * to the deterministic explanations (so a careless edit is caught by a
 * test) and, critically, to any text an optional LLM returns — an AI
 * that volunteers "this looks like early dementia" must be rejected
 * outright rather than displayed.
 *
 * The rule of thumb this encodes: describe THE ACTIVITY, never the
 * person's health.
 *
 *   ✗ "memory function has declined"   ✓ "memory activities have been
 *                                          more challenging recently"
 *   ✗ "at risk of dementia"            ✓ "activity pattern has changed"
 *   ✗ "cognitive impairment"           ✓ "may benefit from more practice"
 *
 * Scope note: this guard governs the INTELLIGENCE layer's own output.
 * It is not applied to unrelated product copy — Phase 4's "Medication
 * reminder", for instance, is a legitimate label chosen by a caregiver.
 */

/** Phrases that must never appear in generated intelligence copy. */
export const FORBIDDEN_PHRASES: string[] = [
  // Conditions and diagnosis
  "dementia",
  "alzheimer",
  "diagnos", // diagnosis, diagnose, diagnostic
  "prognos",
  "disease",
  "disorder",
  "syndrome",
  "symptom",
  "patholog",
  // Clinical framing
  "clinical",
  "medical condition",
  "medically",
  "patient",
  "treatment",
  "prescri", // prescribe, prescription
  "therapy",
  "doctor recommends",
  // Impairment / risk language
  "impairment",
  "impaired",
  "cognitive decline",
  "mental decline",
  "brain health",
  "brain damage",
  "deteriorat",
  "at risk of",
  "risk score",
  "risk level",
  // Pseudo-measurement
  "cognitive score",
  "brain score",
  "iq",
];

export interface SafetyResult {
  safe: boolean;
  /** Which forbidden phrases were found (lowercased). */
  violations: string[];
}

/**
 * Check a piece of generated copy against the boundary.
 * Matching is case-insensitive substring matching, which is
 * deliberately blunt: a false positive costs us one reworded sentence,
 * a false negative costs a person a frightening claim about their health.
 */
export function checkCopy(text: string): SafetyResult {
  const haystack = text.toLowerCase();
  const violations = FORBIDDEN_PHRASES.filter((phrase) => {
    if (phrase === "iq") {
      // Whole word only, so "unique" and "critique" do not trip it.
      return /\biq\b/.test(haystack);
    }
    return haystack.includes(phrase);
  });
  return { safe: violations.length === 0, violations };
}

/** Convenience for tests and assertions. */
export function isSafeCopy(text: string): boolean {
  return checkCopy(text).safe;
}

/**
 * Check every string in a generated object. Used on LLM output before
 * anything reaches a screen.
 */
export function checkAllCopy(values: Array<string | null | undefined>): SafetyResult {
  const violations = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const violation of checkCopy(value).violations) violations.add(violation);
  }
  return { safe: violations.size === 0, violations: [...violations] };
}
