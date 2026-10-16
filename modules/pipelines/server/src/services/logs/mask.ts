import { maskWith, secretForms } from '../../../../shared/secret-forms.ts';

/*
 * Secret values never reach storage or a viewer: every known value in a line becomes ***, in
 * each form a log shows it (secret-forms.ts). The runner masks first; this is the second
 * pass, for runners that do not. Values shorter than four characters are not masked: they
 * would blank ordinary words and hide nothing worth hiding.
 */

export function createMasker(values: Iterable<string>): (line: string) => string {
  const forms = secretForms(values, 4);
  if (forms.length === 0) return (line) => line;
  return (line) => maskWith(forms, line);
}
