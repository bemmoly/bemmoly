export type Strength = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS: Record<Strength, string> = {
  0: 'too short',
  1: 'weak',
  2: 'fair',
  3: 'strong',
  4: 'very strong',
};

/**
 * A rough guide, never a rule: the length policy is the only rule. Under the minimum it is 0;
 * after that length counts most, and mixing kinds of character a little.
 */
export function passwordStrength(value: string, minLength = 12): Strength {
  if (value.length < minLength) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) => kind.test(value)).length;
  const distinct = new Set(value).size;
  if (distinct < 4) return 1;
  let score = 1;
  if (value.length >= minLength + 4 || kinds >= 3) score += 1;
  if (value.length >= minLength + 8 || (value.length >= minLength + 4 && kinds >= 2)) score += 1;
  if (value.length >= minLength + 12 && kinds >= 2) score += 1;
  return Math.min(score, 4) as Strength;
}
