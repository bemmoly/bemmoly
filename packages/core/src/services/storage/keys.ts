import { ValidationError } from '@bemmoly/shared';

/** Keys are relative paths of safe segments; never absolute, never `..`. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertObjectKey(key: string): string {
  const segments = key.split('/');
  const valid =
    key.length > 0 &&
    key.length <= 512 &&
    segments.every(
      (segment) => SEGMENT.test(segment) && segment !== '..' && !segment.endsWith('.tmp'),
    );
  if (!valid) throw new ValidationError(`"${key}" is not a valid object key`);
  return key;
}

/** `attachments/sha256/ab/cd/abcd…`: two levels of fan-out keep directories small. */
export function contentKey(prefix: string, sha256: string): string {
  return assertObjectKey(`${prefix}/sha256/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`);
}
