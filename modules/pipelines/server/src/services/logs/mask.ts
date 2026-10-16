/*
 * Secret values never reach storage or a viewer: every known value in a line becomes ***.
 * Longest first, so a secret that contains another is masked whole. Values shorter than four
 * characters are not masked: they would blank ordinary words and hide nothing worth hiding.
 */

export const MASK = '***';

export function createMasker(values: Iterable<string>): (line: string) => string {
  const secrets = [...new Set([...values].filter((value) => value.length >= 4))].sort(
    (a, b) => b.length - a.length,
  );
  if (secrets.length === 0) return (line) => line;
  return (line) => {
    let out = line;
    for (const secret of secrets) {
      if (out.includes(secret)) out = out.split(secret).join(MASK);
    }
    return out;
  };
}
