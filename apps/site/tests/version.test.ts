/**
 * One version everywhere. The site's version is derived once, at build time, from the
 * packages' release notes capped at the newest published GitHub release (src/lib/changelog.ts,
 * LATEST); every page, the JSON-LD and llms.txt must name that release and no other. Only /changelog and its feed list the
 * older ones. Run `pnpm build` first.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { HtmlElement } from 'html-validate';
import {
  compareVersions,
  LATEST,
  PUBLISHED_VERSION,
  RELEASES,
  releasedOnly,
  type Release,
} from '../src/lib/changelog.ts';
import { RELEASE_TITLES } from '../src/data/changelog.ts';
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
  // The homepage's recent releases are the changelog's own list, the one place a page may
  // name older versions; history() below checks that list against the release notes.
  const inHistory = (element: HtmlElement | null): boolean =>
    element !== null && (element.hasAttribute(HISTORY_LIST) || inHistory(element.parent));
  const attributes = page
    .querySelectorAll('*')
    .filter((element) => !inHistory(element))
    .flatMap((element) => element.attributes.map((attribute) => String(attribute.value ?? '')));
  const data = scriptsOf(page)
    .filter((script) => script.type === 'application/ld+json')
    .map((script) => script.body);
  const history = page.querySelectorAll(`[${HISTORY_LIST}]`).map((list) => list.textContent);
  const text = page
    .querySelectorAll('body, title')
    .map((element) => history.reduce((rest, list) => rest.replace(list, ''), element.textContent));
  return [...text, ...attributes, ...data].join('\n');
}

const HISTORY_LIST = 'data-release-history';

/** The versions a page's release lists name. */
const history = (file: string) =>
  parsePage(read(file))
    .querySelectorAll(`[${HISTORY_LIST}]`)
    .flatMap((list) => versionsIn(list.textContent))
    .filter((version): version is string => Boolean(version));

describe('version', () => {
  it('is derived from a published release', () => {
    expect(LATEST.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(files)('%s names no release but the newest', (file) => {
    const others = versionsIn(readable(file)).filter((version) => version !== LATEST.version);
    expect(others, file).toEqual([]);
  });

  it('lists only released versions in a release history, newest first', () => {
    const listed = history('index.html');
    // The home page lists minor releases (and titled ones); a patch on top of the newest minor
    // is the latest release without being listed, so the list starts at that minor.
    const newestListed = RELEASES.find(
      (release) => RELEASE_TITLES[release.version] ?? release.version.endsWith('.0'),
    );
    expect(listed[0]).toBe(newestListed?.version);
    expect(compareVersions(LATEST.version, listed[0] ?? '')).toBeLessThanOrEqual(0);
    const released = RELEASES.map((release) => release.version);
    for (const version of listed) expect(released, version).toContain(version);
    expect([...listed].sort(compareVersions)).toEqual(listed);
  });

  it('is the version the home page, JSON-LD and install guide show', () => {
    expect(versionsIn(readable('index.html'))).toContain(LATEST.version);
    expect(versionsIn(readable('self-hosting.html'))).toContain(LATEST.version);
    const graph = scriptsOf(parsePage(read('index.html'))).find(
      (script) => script.type === 'application/ld+json',
    );
    expect(graph?.body).toContain(`"softwareVersion":"${LATEST.version}"`);
  });

  it('is the published release when GitHub answers, never a version only tagged', () => {
    if (PUBLISHED_VERSION) expect(LATEST.version).toBe(PUBLISHED_VERSION);
    const release = (version: string): Release => ({ version, date: null, changes: [] });
    const notes = ['0.13.0', '0.12.0', '0.11.0'].map(release);
    expect(releasedOnly(notes, '0.12.0').map((r) => r.version)).toEqual(['0.12.0', '0.11.0']);
    expect(releasedOnly(notes, null).map((r) => r.version)).toEqual(['0.13.0', '0.12.0', '0.11.0']);
  });

  it('is never ahead of the product packages, which the changesets tool bumps first', () => {
    // The fixed group moves @bemmoly/* together when the version pull request merges; the
    // release is published after, so the packages may lead the site by one release, never trail.
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
    const versions = manifests.map(
      (folder) =>
        (
          JSON.parse(readFileSync(new URL(`${folder}/package.json`, repo), 'utf8')) as {
            version: string;
          }
        ).version,
    );
    expect(new Set(versions).size).toBe(1);
    expect(compareVersions(versions[0] ?? '', LATEST.version)).toBeLessThanOrEqual(0);
  });

  it('bundles the demo with the version apps/web carries', () => {
    // The demo is the shell built from main, so it reports the packages' version, which can
    // lead the published release for the hours between a version bump and its publish.
    const { version } = JSON.parse(
      readFileSync(new URL('apps/web/package.json', repo), 'utf8'),
    ) as { version: string };
    const assets = readdirSync(new URL('demo/assets/', dist)).filter((file) =>
      file.endsWith('.js'),
    );
    // The define in apps/web's vite.config.ts, whatever quotes the minifier picks.
    const literals = ['`', '"', "'"].map((quote) => `version:${quote}${version}${quote}`);
    const bundled = assets.some((file) => {
      const code = read(`demo/assets/${file}`);
      return literals.some((literal) => code.includes(literal));
    });
    expect(bundled).toBe(true);
  });
});
