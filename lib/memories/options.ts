/**
 * MEMORIES — building the choices for a recall prompt (pure).
 * -----------------------------------------------------------------
 * Both the original "Do you remember?" activity and Memory Lane ask
 * the same shaped question — here is something of yours, which of
 * these is it? — but over different LABELS. One asks for a name,
 * another for a relationship, another for what a photograph was of.
 *
 * So the rule for choosing distractors lives here once, parameterised
 * by how to read a label off a memory, rather than being written out
 * again per mode. There is one behaviour to keep correct, and one
 * place it can go wrong.
 *
 * The rule itself, in order of preference:
 *
 *  1. the person's OWN other memories in the same category — far more
 *     meaningful than random words, and the reason the activity feels
 *     personal rather than generic;
 *  2. their memories in other categories;
 *  3. neutral filler, only to top up when somebody has very few
 *     memories and there would otherwise be nothing to choose between.
 *
 * Labels are de-duplicated case-insensitively, so two sisters both
 * recorded as "Didi" never appear as two identical buttons — which
 * would make the prompt unanswerable rather than difficult.
 */

export interface LabelledOption {
  id: string;
  label: string;
}

export interface OptionSource<T> {
  /** The memory the prompt is actually about. */
  target: T;
  /** Every candidate, including the target; it is filtered out. */
  pool: readonly T[];
  /** Stable id for a memory. */
  idOf: (item: T) => string;
  /**
   * The label for this prompt mode. Returning null excludes the memory
   * from the options entirely — a memory with no relationship recorded
   * cannot be a distractor in a relationship question.
   */
  labelOf: (item: T) => string | null;
  /** True when two memories are "alike" and make better distractors. */
  isSimilar?: (item: T, target: T) => boolean;
  /** Neutral labels used only to top up a short list. */
  filler: readonly string[];
  /** Total options including the correct one. */
  count: number;
}

/**
 * The distractors for one prompt, excluding the correct answer.
 *
 * `shuffleFn` is injected rather than imported so a caller that needs
 * a reproducible order (a test, or a deterministic demo) can pass an
 * identity function. The default is the real shuffle, because a fixed
 * option order would let somebody answer by position instead of by
 * recognising the photograph.
 */
export function buildDistractors<T>(
  source: OptionSource<T>,
  shuffleFn: <V>(items: readonly V[]) => V[],
): LabelledOption[] {
  const { target, pool, idOf, labelOf, isSimilar, filler, count } = source;

  const need = Math.max(0, count - 1);
  if (need === 0) return [];

  const targetId = idOf(target);
  const targetLabel = labelOf(target);
  const seen = new Set<string>();
  if (targetLabel) seen.add(targetLabel.toLowerCase());

  const others = pool.filter((item) => idOf(item) !== targetId);
  const similar = isSimilar
    ? others.filter((item) => isSimilar(item, target))
    : others;
  const rest = isSimilar
    ? others.filter((item) => !isSimilar(item, target))
    : [];

  const chosen: LabelledOption[] = [];

  for (const item of [...shuffleFn(similar), ...shuffleFn(rest)]) {
    if (chosen.length >= need) break;
    const label = labelOf(item);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push({ id: idOf(item), label });
  }

  for (const label of filler) {
    if (chosen.length >= need) break;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Prefixed so a filler id can never collide with a real memory id,
    // which is what the answer check compares against.
    chosen.push({ id: `filler-${label}`, label });
  }

  return chosen.slice(0, need);
}
