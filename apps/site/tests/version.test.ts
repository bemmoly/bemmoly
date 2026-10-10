/**
 * One version everywhere. The site's version is derived once, at build time, from the
 * packages' release notes (src/lib/changelog.ts, LATEST); every page, the JSON-LD, llms.txt
 * and the demo must name that release and no other. Only /changelog and its feed list the
 * older ones. Run `pnpm build` first.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LATEST } from '../src/lib/changelog.ts';
import { parsePage, scriptsOf } from './dom.ts';

const repo = new URL('../../../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, dist), 'utf8');

/** x.y.z, with or without a v, but not a piece of an address such as 127.0.0.1. */
const VERSION = /(?<![\w.-])v?(\d+\.\d+\.\d+)(?![.\d])/g;
const versionsIn = (text: string) => [...text.matchAll(VERSION)].map((match) => match[1]);

/** The release history is the one place older versions belong. */
const HISTORY = new Set(['changelog.html', 'changelog.xml']);
const files = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(
  (file) => /\.(html|txt|xml|webmanifest)$/.test(file) && !HISTORY.has(file),
);

/** What a visitor or a crawler reads: the text, the attributes and the JSON-LD, not the CSS. */
function readable(file: string): string {
  const source = read(file);
  if (!file.endsWith('.html')) return source;
  const page = parsePage(source);
  const attributes = page
    .querySelectorAll('*')
    .flatMap((element) => element.attributes.map((attribute) => String(attribute.value ?? '')));
  const data = scriptsOf(page)
    .filter((script) => script.type === 'application/ld+json')
    .map((script) => script.body);
  const text = page.querySelectorAll('body, title').map((element) => element.textContent);
  return [...text, ...attributes, ...data].join('\n');
}

describe('version', () => {
  it('is derived from a published release', () => {
    expect(LATEST.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(files)('%s names no release but the newest', (file) => {
    const others = versionsIn(readable(file)).filter((version) => version !== LATEST.version);
    expect(others, file).toEqual([]);
  });

  it('is the version the home page, JSON-LD and install guide show', () => {
    expect(versionsIn(readable('index.html'))).toContain(LATEST.version);
    expect(versionsIn(readable('docs/install.html'))).toContain(LATEST.version);
    const graph = scriptsOf(parsePage(read('index.html'))).find(
      (script) => script.type === 'application/ld+json',
    );
    expect(graph?.body).toContain(`"softwareVersion":"${LATEST.version}"`);
  });

  it('is the version every product package carries, so the demo reports it too', () => {
    // The changesets tool bumps @bemmoly/* as one fixed group; the demo build reads
    // apps/web/package.json, so it reports the same release as the pages.
    const manifests = [
      'apps/web',
      'apps/server',
      'packages/core',
      'packages/core-web',
      'packages/shared',
      'packages/ui',
      'modules/work',
      'deploy',
    ];
    for (const folder of manifests) {
      const manifest = JSON.parse(readFileSync(new URL(`${folder}/package.json`, repo), 'utf8'));
      expect((manifest as { version: string }).version, folder).toBe(LATEST.version);
    }
  });

  it('is the version the demo build carries', () => {
    const assets = readdirSync(new URL('demo/assets/', dist)).filter((file) =>
      file.endsWith('.js'),
    );
    // The define in apps/web's vite.config.ts, whatever quotes the minifier picks.
    const literal = new RegExp(`version:[\`"']${LATEST.version.replace(/\./g, '\\.')}[\`"']`);
    const bundled = assets.some((file) => literal.test(read(`demo/assets/${file}`)));
    expect(bundled).toBe(true);
  });
});
