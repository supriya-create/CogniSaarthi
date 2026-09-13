type ClassValue = string | false | null | undefined;

/**
 * Minimal class joiner. Components in this project compose classes
 * through explicit variant maps rather than by overriding each
 * other, so a full class-merge library is not needed.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
