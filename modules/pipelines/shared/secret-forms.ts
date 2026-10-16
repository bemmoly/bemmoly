import type { TestReportUpload } from './runner.ts';

/*
 * The forms a secret takes in a log besides itself. The runner masks with these before a line
 * leaves the machine and the server masks with them again before a line is stored, so both
 * hide the same things: each line of a multi-line value (a key file prints one line at a
 * time), the value URL-encoded and JSON-escaped, and the value base64-encoded (`echo $TOKEN |
 * base64`, a value inside a config dump). Masking is a guard against accidents, not against a
 * step that means to leak: code that runs with a secret can always print it reshaped.
 */

export const SECRET_MASK = '***';

/** Shorter base64 runs than this would hide ordinary words and protect nothing. */
const MIN_ENCODED_LENGTH = 8;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Base64 depends on where the value starts within a 3-byte group, so each of the three
 * alignments has its own encoding. The characters that mix in a neighbour's bits (the first
 * group when the value starts mid-group, the last partial group) are left out; what is left
 * appears whenever the value is encoded, whatever surrounds it.
 */
function base64Forms(value: string): string[] {
  const bytes = new TextEncoder().encode(value);
  const forms: string[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const padded = new Uint8Array(offset + bytes.length);
    padded.set(bytes, offset);
    const encoded = toBase64(padded);
    const stable = encoded.slice(offset === 0 ? 0 : 4, Math.floor(padded.length / 3) * 4);
    if (stable.length < MIN_ENCODED_LENGTH) continue;
    forms.push(stable, stable.replace(/\+/g, '-').replace(/\//g, '_'));
  }
  return forms;
}

/** Every string to mask for these secret values, longest first so a longer form wins. */
export function secretForms(values: Iterable<string>, minLength: number): string[] {
  const forms = new Set<string>();
  const add = (form: string) => {
    if (form.length >= minLength) forms.add(form);
  };
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length < minLength) continue;
    for (const part of [trimmed, ...trimmed.split(/\r?\n/)]) add(part.trim());
    add(encodeURIComponent(trimmed));
    add(JSON.stringify(trimmed).slice(1, -1));
    for (const form of base64Forms(trimmed)) add(form);
  }
  return [...forms].sort((a, b) => b.length - a.length);
}

/** Replaces every form of every secret in a line with ***. */
export function maskWith(forms: readonly string[], line: string): string {
  let out = line;
  for (const form of forms) {
    if (out.includes(form)) out = out.split(form).join(SECRET_MASK);
  }
  return out;
}

/** Test names and failure messages print values as freely as a log does; mask them alike. */
export function maskedReport(
  report: TestReportUpload,
  mask: (text: string) => string,
): TestReportUpload {
  return {
    ...report,
    cases: report.cases.map((testCase) => ({
      ...testCase,
      name: mask(testCase.name),
      ...(typeof testCase.message === 'string' ? { message: mask(testCase.message) } : {}),
    })),
  };
}
