/**
 * Matching a spoken answer against the accepted labels for a game
 * tile. Pure and testable. Kept lenient on purpose: an older adult
 * saying "an apple" or "a red apple" should match "Apple", and
 * leading articles or extra words should not fail a correct answer.
 */

const LEADING_ARTICLES = /^(a|an|the|यह|एक|এইটো|এটা)\s+/i;

export function normaliseAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

/**
 * True when the spoken text matches any accepted label. A match is
 * either an exact normalised equality or the label appearing as a
 * whole word inside the spoken phrase ("it is an apple" → "apple").
 */
export function matchesAnswer(
  spoken: string,
  acceptedLabels: string[],
): boolean {
  const said = normaliseAnswer(spoken);
  if (!said) return false;

  return acceptedLabels.some((label) => {
    const target = normaliseAnswer(label);
    if (!target) return false;
    if (said === target) return true;
    // whole-word containment either direction
    const inSaid = new RegExp(`(^|\\s)${escapeRegex(target)}(\\s|$)`).test(said);
    return inSaid;
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
