/** Fisher–Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** `count` distinct items, or the whole list if it is shorter. */
export function sample<T>(items: readonly T[], count: number): T[] {
  return shuffle(items).slice(0, Math.min(count, items.length));
}

export function pickOne<T>(items: readonly T[]): T {
  return items[randomIndex(items.length)];
}

/** A random integer in [0, length). */
export function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}
