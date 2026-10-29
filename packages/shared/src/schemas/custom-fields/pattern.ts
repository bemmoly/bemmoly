/**
 * A field's pattern is written by an admin and run on the server against every value saved,
 * so one that backtracks for minutes would hang a request. JavaScript has no linear-time
 * engine, so patterns are kept to a shape whose worst case stays small:
 * - at most three choice points (a repeat of variable length, an optional part, an alternative);
 * - no repeat of a group that itself repeats, chooses or looks around, so counts never multiply;
 * - no count above PATTERN_INPUT_MAX, no backreferences, and balanced groups, so the pattern
 *   cannot close the `^(?:…)$` it is wrapped in and match less than the whole value;
 * - values of at most PATTERN_INPUT_MAX characters.
 * Three choice points over 200 characters is a few million steps at worst.
 */
export const PATTERN_INPUT_MAX = 200;
const MAX_CHOICES = 3;

export function fieldPattern(pattern: string): RegExp | null {
  if (!bounded(pattern)) return null;
  try {
    new RegExp(pattern);
    return new RegExp(`^(?:${pattern})$`);
  } catch {
    return null;
  }
}

/** A `{n}` repeats exactly; `{n,}` and `{n,m}` with m above n are choices. */
function quantifierAt(
  pattern: string,
  i: number,
): { length: number; varies: boolean; count: number } | null {
  const char = pattern[i];
  if (char === '*' || char === '+' || char === '?') return { length: 1, varies: true, count: 1 };
  if (char !== '{') return null;
  const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i));
  if (!match) return null;
  const varies = match[2] !== undefined && match[3] !== match[1];
  const count = Math.max(Number(match[1]), Number(match[3] || 0));
  return { length: match[0].length, varies, count };
}

interface Group {
  /** Holds a choice point, a repeat of any kind, or is a lookaround: never repeat it. */
  unsafe: boolean;
}

function bounded(pattern: string): boolean {
  const groups: Group[] = [];
  let closed: Group | null = null;
  let choices = 0;
  const markOpen = () => {
    if (groups.length > 0) groups[groups.length - 1]!.unsafe = true;
  };
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const quantifier = quantifierAt(pattern, i);
    if (quantifier) {
      if (closed?.unsafe || quantifier.count > PATTERN_INPUT_MAX) return false;
      if (quantifier.varies) choices += 1;
      markOpen();
      i += quantifier.length - 1;
      // A lazy marker right after is part of the same repeat.
      if (pattern[i + 1] === '?') i += 1;
      closed = null;
      continue;
    }
    closed = null;
    if (char === '\\') {
      if (/[1-9k]/.test(pattern[i + 1] ?? '')) return false;
      i += 1;
    } else if (char === '[') {
      i += 1;
      while (i < pattern.length && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
    } else if (char === '(') {
      const group: Group = { unsafe: false };
      // Skip a `(?:`, lookaround or `(?<name>` marker so its `?` is not read as a repeat.
      if (pattern[i + 1] === '?') {
        const marker = /^\?(?::|=|!|<=|<!|<[A-Za-z_]\w*>)/.exec(pattern.slice(i + 1));
        if (!marker) return false;
        group.unsafe = ['?=', '?!', '?<=', '?<!'].includes(marker[0]);
        i += marker[0].length;
      }
      groups.push(group);
    } else if (char === ')') {
      const group = groups.pop();
      if (!group) return false;
      if (group.unsafe) markOpen();
      closed = group;
    } else if (char === '|') {
      choices += 1;
      markOpen();
    }
    if (choices > MAX_CHOICES) return false;
  }
  return groups.length === 0 && choices <= MAX_CHOICES;
}
