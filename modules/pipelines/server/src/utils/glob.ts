/*
 * Path globs as people write them in `paths:` filters and artifact lists: `*` within one
 * segment, `**` across segments, `?` one character, `{a,b}` alternatives. Small on purpose:
 * no character classes, no extglobs, so a filter means what it looks like.
 */

const cache = new Map<string, RegExp>();

function escape(text: string): string {
  return text.replace(/[.+^$()|[\]\\]/g, '\\$&');
}

function translate(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? '';
    if (char === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if (char === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        out += '\\{';
        continue;
      }
      out += `(?:${glob
        .slice(i + 1, end)
        .split(',')
        .map((part) => translate(part))
        .join('|')})`;
      i = end;
    } else {
      out += escape(char);
    }
  }
  return out;
}

export function globToRegExp(glob: string): RegExp {
  const normalised = glob.replace(/^\.\//, '').replace(/\/$/, '/**');
  let pattern = cache.get(normalised);
  if (!pattern) {
    pattern = new RegExp(`^${translate(normalised)}$`);
    cache.set(normalised, pattern);
  }
  return pattern;
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path.replace(/^\.\//, ''));
}

/** Filters with `!` exclude; a path matches when an include does and no exclude does. */
export function matchesFilters(path: string, filters: readonly string[]): boolean {
  const includes = filters.filter((filter) => !filter.startsWith('!'));
  const excludes = filters.filter((filter) => filter.startsWith('!')).map((f) => f.slice(1));
  const included = includes.length === 0 || includes.some((glob) => matchesGlob(path, glob));
  return included && !excludes.some((glob) => matchesGlob(path, glob));
}
