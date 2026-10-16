/**
 * Values shorter than this are not masked: hiding every "1" or "on" in a log makes it unreadable
 * and protects nothing a guess would not find.
 */
const MIN_SECRET_LENGTH = 3;

/** Replaces every known secret value in a line with ***. */
export class SecretMasker {
  private values: string[] = [];

  add(values: Iterable<string>): void {
    const next = new Set(this.values);
    for (const value of values) {
      // A multi-line secret (a key file) prints one line at a time, so each line is a secret.
      for (const part of [value, ...value.split(/\r?\n/)]) {
        const trimmed = part.trim();
        if (trimmed.length >= MIN_SECRET_LENGTH) next.add(trimmed);
      }
    }
    // Longest first, so a secret that contains another is hidden whole.
    this.values = [...next].sort((a, b) => b.length - a.length);
  }

  mask(line: string): string {
    let out = line;
    for (const value of this.values) {
      if (out.includes(value)) out = out.split(value).join('***');
    }
    return out;
  }
}
