/**
 * Slash trimming by index, not by regex: an end-anchored /\/+$/ retries from every
 * slash in a long run of them, which is quadratic in the length of the run.
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) end -= 1;
  return value.slice(0, end);
}

export function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === 0x2f) start += 1;
  return value.slice(start);
}

export function trimSlashes(value: string): string {
  return trimLeadingSlashes(trimTrailingSlashes(value));
}
