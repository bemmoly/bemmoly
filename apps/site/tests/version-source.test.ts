/**
 * No hard-coded versions. Every version the site shows comes from src/lib/changelog.ts
 * (LATEST and RELEASES), which the release process keeps current: the changesets tool writes
 * the notes and the release workflow publishes the GitHub release that caps them. A version
 * typed into a page, a script or the public folder goes stale the next release, so this fails
 * on any x.y.z outside src/data/changelog.ts, whose dates and titles are history. Comments may
 * cite the release a fact comes from; they never reach a visitor.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { removeAll } from './dom.ts';

const site = new URL('../', import.meta.url);
const ROOTS = ['src', 'scripts', 'public'];
const HISTORY = new Set(['src/data/changelog.ts']);
const TEXT = /\.(astro|ts|js|mjs|css|json|md|txt|sh|html|svg|xml)$/;

const sources = [
  'astro.config.ts',
  ...ROOTS.flatMap((root) =>
    readdirSync(new URL(root, site), { recursive: true, encoding: 'utf8' }).map(
      (file) => `${root}/${file}`,
    ),
  ),
].filter((file) => TEXT.test(file) && !HISTORY.has(file));

/** Block, HTML and line comments out; a line comment needs a space or line start before it. */
const withoutComments = (code: string) =>
  removeAll(removeAll(code, /\/\*[\s\S]*?\*\//g), /<!--[\s\S]*?-->/g)
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/^\s*#(?!!).*$/gm, '');

/** x.y.z, with or without a v, but not a piece of an address such as 127.0.0.1. */
const VERSION = /(?<![\w.@/-])v?\d+\.\d+\.\d+(?![.\d])/g;

describe('version sources', () => {
  it('scans the site', () => {
    expect(sources).toContain('src/lib/changelog.ts');
    expect(sources).toContain('src/components/landing/Hero.astro');
  });

  it.each(sources)('%s hard-codes no version', (file) => {
    const code = withoutComments(readFileSync(new URL(file, site), 'utf8'));
    expect(code.match(VERSION) ?? [], file).toEqual([]);
  });
});
