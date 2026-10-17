import {
  globMatcher,
  simpleGlobTokens,
  type GlobMatcher,
  type GlobToken,
} from '../../utils/glob-match.ts';

/*
 * The two pattern languages discovery reads: workspace globs ("apps/*", "services/**")
 * and CODEOWNERS rules (gitignore-style, last match wins). Both are a repository's own
 * files, so they compile to matchers that never backtrack, not to regular expressions.
 */

/** The folder a file sits in; "" for the root. */
export const dirOf = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

const clean = (glob: string) => glob.trim().replace(/^\.\//, '').replace(/\/+$/, '');

/** "apps/*" matches "apps/web" but not "apps/web/src"; "services/**" matches any depth. */
export function compileGlob(glob: string): GlobMatcher {
  return globMatcher(simpleGlobTokens(clean(glob), { question: true }));
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  const included = globs.filter((glob) => !glob.trim().startsWith('!'));
  const excluded = globs
    .filter((glob) => glob.trim().startsWith('!'))
    .map((g) => g.trim().slice(1));
  return (
    included.some((glob) => compileGlob(glob).test(path)) &&
    !excluded.some((glob) => compileGlob(glob).test(path))
  );
}

export interface OwnerRule {
  pattern: GlobMatcher;
  owners: string[];
}

/** One CODEOWNERS rule as a matcher over files and folders inside the repository. */
function ruleMatcher(raw: string): GlobMatcher {
  const anchored = raw.startsWith('/') || raw.slice(0, -1).includes('/');
  const directory = raw.endsWith('/');
  const body = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (body === '*' || body === '**') return { test: () => true };
  const under: GlobToken[] = [{ kind: 'char', char: '/' }, { kind: 'any' }];
  // A rule names a file or a folder; a folder owns everything under it.
  const lead: GlobToken[] = anchored ? [] : [{ kind: 'dirs' }];
  const tail: GlobToken[] = directory ? under : [{ kind: 'either', options: [[], under] }];
  return globMatcher([...lead, ...simpleGlobTokens(clean(body), { question: true }), ...tail]);
}

export function parseCodeowners(text: string): OwnerRule[] {
  const rules: OwnerRule[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*$/, '').trim();
    if (!trimmed) continue;
    const [pattern = '', ...owners] = trimmed.split(/\s+/);
    if (owners.length === 0) continue;
    rules.push({ pattern: ruleMatcher(pattern), owners });
  }
  return rules;
}

/** The owners of a folder ("" for the root): the last rule that matches it wins. */
export function ownersOf(rules: readonly OwnerRule[], folder: string): string[] {
  const probe = folder ? `${folder}/` : '';
  let owners: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(folder) || rule.pattern.test(probe) || rule.pattern.test(`${probe}x`)) {
      owners = rule.owners;
    }
  }
  return owners;
}
