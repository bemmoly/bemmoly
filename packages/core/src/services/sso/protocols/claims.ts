const MAX_GROUPS = 500;
const MAX_GROUP_LENGTH = 256;

/** A claim or attribute that should hold one string; providers sometimes wrap it in a list. */
export function claimString(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string') return null;
  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 320) : null;
}

/**
 * Group names from a claim or attribute: a list, or one string. Bounded, so a hostile or
 * misconfigured provider cannot make one sign-in do unbounded mapping work.
 */
export function claimGroups(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const groups = new Set<string>();
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_GROUP_LENGTH) continue;
    groups.add(trimmed);
    if (groups.size >= MAX_GROUPS) break;
  }
  return [...groups];
}
