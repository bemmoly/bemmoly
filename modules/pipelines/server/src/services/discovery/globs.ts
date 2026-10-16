/*
 * The two pattern languages discovery reads: workspace globs ("apps/*", "services/**")
 * and CODEOWNERS rules (gitignore-style, last match wins). Both compile to regular
 * expressions over "/"-separated paths without a leading slash.
 */

/** The folder a file sits in; "" for the root. */
export const dirOf = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** "apps/*" matches "apps/web" but not "apps/web/src"; "services/**" matches any depth. */
export function globToRegExp(glob: string): RegExp {
  const clean = glob.trim().replace(/^\.\//, '').replace(/\/+$/, '');
  let source = '';
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i] ?? '';
    if (char === '*' && clean[i + 1] === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += escape(char);
  }
  return new RegExp(`^${source}$`);
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  const included = globs.filter((glob) => !glob.trim().startsWith('!'));
  const excluded = globs
    .filter((glob) => glob.trim().startsWith('!'))
    .map((g) => g.trim().slice(1));
  return (
    included.some((glob) => globToRegExp(glob).test(path)) &&
    !excluded.some((glob) => globToRegExp(glob).test(path))
  );
}

export interface OwnerRule {
  pattern: RegExp;
  owners: string[];
}

/** One CODEOWNERS rule as a matcher over files and folders inside the repository. */
function ruleToRegExp(raw: string): RegExp {
  const anchored = raw.startsWith('/') || raw.slice(0, -1).includes('/');
  const directory = raw.endsWith('/');
  const body = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (body === '*' || body === '**') return /^.*$/;
  const compiled = globToRegExp(body).source.slice(1, -1);
  const prefix = anchored ? '^' : '^(?:.*/)?';
  // A rule names a file or a folder; a folder owns everything under it.
  return new RegExp(`${prefix}${compiled}${directory ? '/.*' : '(?:/.*)?'}$`);
}

export function parseCodeowners(text: string): OwnerRule[] {
  const rules: OwnerRule[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*$/, '').trim();
    if (!trimmed) continue;
    const [pattern = '', ...owners] = trimmed.split(/\s+/);
    if (owners.length === 0) continue;
    rules.push({ pattern: ruleToRegExp(pattern), owners });
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
