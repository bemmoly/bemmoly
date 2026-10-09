/**
 * The changelog is built from the packages' CHANGELOG.md files: the parser keeps wrapped
 * notes whole and drops dependency noise, the build reads every product changelog in the
 * repository, the image copies each one, and the feed matches the page.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_FILES,
  CHANGELOG_GLOB,
  collectReleases,
  compareVersions,
  inlineMarkdown,
  paragraphHtml,
  parseChangelog,
  RELEASES,
  releaseId,
} from '../src/lib/changelog.ts';
import { idsOf, parsePage } from './dom.ts';

const repo = new URL('../../../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);

const SAMPLE = `# @bemmoly/core

## 0.1.5

### Patch Changes

- 0278663: Sign-in is now rate limited per account as well as per
  address. The 11th gets \`429 Too Many
Requests\` with a header.

  All limits stay on.

- @bemmoly/shared@0.1.5
  - @bemmoly/ui@0.1.5

## 0.1.4

### Minor Changes

- b98d0c0: Settings › Updates has a "Check for updates" button.
- Updated dependencies [b98d0c0]
  - @bemmoly/shared@0.1.4
`;

describe('parser', () => {
  it('keeps wrapped lines and paragraphs together and drops dependency noise', () => {
    expect(parseChangelog(SAMPLE)).toEqual([
      {
        version: '0.1.5',
        kind: 'patch',
        id: '0278663',
        paragraphs: [
          'Sign-in is now rate limited per account as well as per address. The 11th gets `429 Too Many Requests` with a header.',
          'All limits stay on.',
        ],
      },
      {
        version: '0.1.4',
        kind: 'minor',
        id: 'b98d0c0',
        paragraphs: ['Settings › Updates has a "Check for updates" button.'],
      },
    ]);
  });

  it('lists a note once when several packages carry it, newest release first', () => {
    const releases = collectReleases([SAMPLE, SAMPLE], { '0.1.5': '2026-10-09' });
    expect(releases.map((release) => release.version)).toEqual(['0.1.5', '0.1.4']);
    expect(releases[0]?.changes).toHaveLength(1);
    expect(releases[0]?.date).toBe('2026-10-09');
    expect(releases[1]?.date).toBeNull();
  });

  it('orders versions numerically, a pre-release below its release', () => {
    const sorted = ['0.1.9', '0.2.0-beta.1', '0.1.10', '0.2.0', '0.2.0-beta.2'].sort(
      compareVersions,
    );
    expect(sorted).toEqual(['0.2.0', '0.2.0-beta.2', '0.2.0-beta.1', '0.1.10', '0.1.9']);
  });

  it('keeps a list inside a note as a list', () => {
    const [entry] = parseChangelog(
      '## 0.2.0\n\n### Patch Changes\n\n- e2aa5d2: Fixes:\n\n  - One that wraps\n    onto a second line.\n  - Two.\n',
    );
    expect(entry?.paragraphs).toEqual(['Fixes:', '- One that wraps onto a second line.\n- Two.']);
    expect(paragraphHtml(entry?.paragraphs[1] ?? '')).toBe(
      '<ul><li>One that wraps onto a second line.</li><li>Two.</li></ul>',
    );
  });

  it('renders code and emphasis, and escapes everything else', () => {
    expect(inlineMarkdown('Use `workspace.*.manage` for **all** <b>keys</b>')).toBe(
      'Use <code>workspace.*.manage</code> for <strong>all</strong> &lt;b&gt;keys&lt;/b&gt;',
    );
  });
});

describe('sources', () => {
  it('reads every product changelog in the repository', () => {
    const inRepo = CHANGELOG_GLOB.flatMap((pattern) => {
      const [folder = '', star, ...rest] = pattern.split('/');
      if (star !== '*') return [pattern];
      return readdirSync(new URL(`${folder}/`, repo), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => [folder, entry.name, ...rest].join('/'))
        .filter((path) => {
          try {
            readFileSync(new URL(path, repo));
            return true;
          } catch {
            return false;
          }
        });
    });
    expect([...CHANGELOG_FILES].sort()).toEqual(inRepo.sort());
  });

  it('copies each of them into the site image', () => {
    const dockerfile = readFileSync(new URL('apps/site/Dockerfile', repo), 'utf8');
    for (const path of CHANGELOG_FILES) {
      const folder = path.replace(/CHANGELOG\.md$/, '');
      expect(dockerfile, path).toContain(`COPY ${path} ${folder}\n`);
    }
  });

  it('finds the releases', () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(RELEASES[0]?.changes.length).toBeGreaterThan(0);
  });
});

describe('page and feed', () => {
  const page = readFileSync(new URL('changelog.html', dist), 'utf8');
  const feed = readFileSync(new URL('changelog.xml', dist), 'utf8');

  it('anchors every release on the page', () => {
    const ids = idsOf(parsePage(page));
    for (const release of RELEASES) expect(ids).toContain(releaseId(release.version));
  });

  it('has one feed item per release, each linking to its anchor', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(
      true,
    );
    expect(feed.match(/<item>/g)).toHaveLength(RELEASES.length);
    for (const release of RELEASES) {
      expect(feed).toContain(
        `<link>https://bemmoly.com/changelog#${releaseId(release.version)}</link>`,
      );
    }
    expect(page).toContain(
      '<link rel="alternate" href="/changelog.xml" type="application/rss+xml" title="Bemmoly releases">',
    );
  });
});
