import { maskWith, secretForms } from '@bemmoly/module-pipelines/shared';

/**
 * Values shorter than this are not masked: hiding every "1" or "on" in a log makes it unreadable
 * and protects nothing a guess would not find.
 */
const MIN_SECRET_LENGTH = 3;

/** Replaces every known secret value in a line, in each form a log shows it, with ***. */
export class SecretMasker {
  private values: string[] = [];
  private forms: string[] = [];

  add(values: Iterable<string>): void {
    this.values = [...new Set([...this.values, ...values])];
    this.forms = secretForms(this.values, MIN_SECRET_LENGTH);
  }

  mask(line: string): string {
    return maskWith(this.forms, line);
  }
}
