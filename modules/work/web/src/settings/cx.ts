/** Joins class names, skipping the falsy ones a condition leaves. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
