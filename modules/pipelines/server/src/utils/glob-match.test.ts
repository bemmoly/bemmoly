import { describe, expect, it } from 'vitest';
import { factsOf, globMatch } from '../services/ci/trust.ts';
import {
  compileGlob as workspaceGlob,
  ownersOf,
  parseCodeowners,
} from '../services/discovery/globs.ts';
import { matchesGlob } from './glob.ts';

/** The regular expression the path filters used to compile to: the meaning to keep. */
function reference(glob: string): RegExp {
  const escape = (text: string) => text.replace(/[.+^$()|[\]\\]/g, '\\$&');
  const translate = (pattern: string): string => {
    let out = '';
    for (let i = 0; i < pattern.length; i += 1) {
      const char = pattern[i] ?? '';
      if (char === '*' && pattern[i + 1] === '*') {
        const slash = pattern[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else if (char === '*') out += '[^/]*';
      else if (char === '?') out += '[^/]';
      else if (char === '{' && pattern.indexOf('}', i) !== -1) {
        const end = pattern.indexOf('}', i);
        out += `(?:${pattern
          .slice(i + 1, end)
          .split(',')
          .map(translate)
          .join('|')})`;
        i = end;
      } else out += char === '{' ? '\\{' : escape(char);
    }
    return out;
  };
  return new RegExp(`^${translate(glob)}$`);
}

/** A small seeded generator, so a failure names a case that repeats. */
function random(seed: number) {
  // mulberry32: the low bits of a plain LCG repeat too soon to mix the parts well.
  let state = seed;
  return (n: number) => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

const pick = (next: (n: number) => number, parts: readonly string[], length: number) =>
  Array.from({ length }, () => parts[next(parts.length)]).join('');

describe('glob matching without backtracking', () => {
  it('means what the regular expressions meant', () => {
    const next = random(7);
    for (let i = 0; i < 3_000; i += 1) {
      const glob = pick(
        next,
        ['a', 'b', '/', '*', '**', '**/', '?', '{a,b*}', '.', '{'],
        1 + next(6),
      );
      const path = pick(next, ['a', 'b', '/', '.', '{', 'ab/'], next(8));
      expect([glob, path, matchesGlob(path, glob)]).toEqual([
        glob,
        path,
        reference(glob.replace(/^\.\//, '').replace(/\/$/, '/**')).test(path.replace(/^\.\//, '')),
      ]);
    }
  });

  it('keeps the meaning of trust rule, workspace and CODEOWNERS patterns', () => {
    const escape = (text: string) => text.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
    const trust = (pattern: string) =>
      new RegExp(
        `^${pattern
          .split('**')
          .map((part) => part.split('*').map(escape).join('[^/]*'))
          .join('.*')}$`,
      );
    const workspace = (glob: string) =>
      glob
        .split('**')
        .map((part) => part.split('*').map(escape).join('[^/]*'))
        .join('.*')
        .replace(/\\\?/g, '[^/]');
    const tidy = (glob: string) => glob.replace(/^\.\//, '').replace(/\/+$/, '');
    const owners = (raw: string) => {
      const anchored = raw.startsWith('/') || raw.slice(0, -1).includes('/');
      const body = raw.replace(/^\/+/, '').replace(/\/+$/, '');
      if (body === '*' || body === '**') return /^.*$/;
      const tail = raw.endsWith('/') ? '/.*' : '(?:/.*)?';
      return new RegExp(`${anchored ? '^' : '^(?:.*/)?'}${workspace(tidy(body))}${tail}$`);
    };
    const next = random(11);
    for (let i = 0; i < 3_000; i += 1) {
      const glob = pick(next, ['a', 'b', '/', '*', '**', '?', '.', '('], 1 + next(6));
      const path = pick(next, ['a', 'b', '/', '.', '?', '(', 'ab/'], next(8));
      expect([glob, path, globMatch(glob, path)]).toEqual([glob, path, trust(glob).test(path)]);
      const ws = new RegExp(`^${workspace(tidy(glob))}$`).test(path);
      expect([glob, path, workspaceGlob(glob).test(path)]).toEqual([glob, path, ws]);
      const rule = `${glob} @x`;
      const expected = ['', '/', '/x'].some((end) => owners(glob).test(`${path}${end}`));
      const actual = ownersOf(parseCodeowners(rule), path).length > 0;
      if (path !== '') expect([glob, path, actual]).toEqual([glob, path, expected]);
    }
  });

  it('answers at once on patterns that make a regular expression backtrack for minutes', () => {
    const started = Date.now();
    const long = 'a'.repeat(4_000);
    expect(matchesGlob(long, `${'*a'.repeat(30)}b`)).toBe(false);
    expect(matchesGlob(long, `${'**a'.repeat(30)}b`)).toBe(false);
    expect(globMatch(`${'*a'.repeat(30)}b`, long)).toBe(false);
    expect(workspaceGlob(`${'*a'.repeat(30)}b`).test(long)).toBe(false);
    expect(ownersOf(parseCodeowners(`${'*a'.repeat(30)}b @x`), long)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('keeps trust rule globs literal apart from * and **', () => {
    expect(globMatch('release/?', 'release/1')).toBe(false);
    expect(globMatch('release/?', 'release/?')).toBe(true);
    expect(globMatch('refs/tags/v*', 'refs/tags/v1.2')).toBe(true);
    expect(globMatch('refs/tags/v*', 'refs/tags/v1/x')).toBe(false);
    expect(globMatch('refs/heads/**', 'refs/heads/a/b')).toBe(true);
    expect(globMatch('acme.(x)', 'acme.(x)')).toBe(true);
    expect(factsOf('github', {}, { repository: 'a/b' }).repository).toBe('a/b');
  });

  it('reads CODEOWNERS folders and files at any depth', () => {
    const rules = parseCodeowners('docs/ @docs\n/build.gradle @build\n*.md @md\n');
    expect(ownersOf(rules, 'docs')).toEqual(['@docs']);
    expect(ownersOf(rules, 'docs/deep')).toEqual(['@docs']);
    expect(ownersOf(rules, 'x/docs')).toEqual(['@docs']);
    expect(ownersOf(rules, 'build.gradle')).toEqual(['@build']);
    expect(ownersOf(rules, 'sub/build.gradle')).toEqual([]);
    expect(ownersOf(rules, 'sub/readme.md')).toEqual(['@md']);
  });
});
