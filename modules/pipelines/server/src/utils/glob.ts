import { globMatcher, type GlobMatcher, type GlobToken } from './glob-match.ts';

/*
 * Path globs as people write them in `paths:` filters and artifact lists: `*` within one
 * segment, `**` across segments, `?` one character, `{a,b}` alternatives. Small on purpose:
 * no character classes, no extglobs, so a filter means what it looks like.
 */

/** Compiled filters, kept a while; cleared when full so a stream of new patterns cannot grow it. */
const cache = new Map<string, GlobMatcher>();
const CACHE_LIMIT = 1_000;

function tokensOf(glob: string): GlobToken[] {
  const tokens: GlobToken[] = [];
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? '';
    if (char === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        tokens.push({ kind: slash ? 'dirs' : 'any' });
        i += slash ? 2 : 1;
      } else {
        tokens.push({ kind: 'star' });
      }
    } else if (char === '?') {
      tokens.push({ kind: 'one' });
    } else if (char === '{' && glob.indexOf('}', i) !== -1) {
      const end = glob.indexOf('}', i);
      tokens.push({
        kind: 'either',
        options: glob
          .slice(i + 1, end)
          .split(',')
          .map((part) => tokensOf(part)),
      });
      i = end;
    } else {
      tokens.push({ kind: 'char', char });
    }
  }
  return tokens;
}

export function compileGlob(glob: string): GlobMatcher {
  const normalised = glob.replace(/^\.\//, '').replace(/\/$/, '/**');
  let matcher = cache.get(normalised);
  if (!matcher) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    matcher = globMatcher(tokensOf(normalised));
    cache.set(normalised, matcher);
  }
  return matcher;
}

export function matchesGlob(path: string, glob: string): boolean {
  return compileGlob(glob).test(path.replace(/^\.\//, ''));
}

/** Filters with `!` exclude; a path matches when an include does and no exclude does. */
export function matchesFilters(path: string, filters: readonly string[]): boolean {
  const includes = filters.filter((filter) => !filter.startsWith('!'));
  const excludes = filters.filter((filter) => filter.startsWith('!')).map((f) => f.slice(1));
  const included = includes.length === 0 || includes.some((glob) => matchesGlob(path, glob));
  return included && !excludes.some((glob) => matchesGlob(path, glob));
}
