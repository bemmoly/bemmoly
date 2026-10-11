/**
 * The release notes, read at build time from the CHANGELOG.md files the changesets tool
 * writes for the product's packages (the marketing site and the build tools are left out).
 * Every package moves in one fixed version group, so one note can appear in several files;
 * it is listed once. Dependency bumps are noise and are dropped.
 *
 * The Dockerfile copies these files into the build; tests/changelog.test.ts fails when a
 * package's changelog is missing from that list.
 */
import { posix } from 'node:path';
import { RELEASE_DATES, ROADMAP, UNPUBLISHED } from '../data/changelog.ts';
import { fetchPublishedVersion } from './clients/github.ts';

export type ChangeKind = 'major' | 'minor' | 'patch';

export interface ReleaseChange {
  kind: ChangeKind;
  /**
   * The note's paragraphs, as written: Markdown with inline code and emphasis only. A
   * paragraph of "- " lines is a list and keeps one item per line.
   */
  paragraphs: string[];
}

export interface Release {
  version: string;
  /** ISO date the version was tagged, when src/data/changelog.ts knows it. */
  date: string | null;
  changes: ReleaseChange[];
}

/** Repository paths of the changelogs read, relative to the repository root. */
export const CHANGELOG_GLOB = [
  'apps/server/CHANGELOG.md',
  'apps/web/CHANGELOG.md',
  'packages/*/CHANGELOG.md',
  'modules/*/CHANGELOG.md',
  'deploy/CHANGELOG.md',
  'deploy/updater/CHANGELOG.md',
] as const;

const files = import.meta.glob(
  [
    '../../../../apps/server/CHANGELOG.md',
    '../../../../apps/web/CHANGELOG.md',
    '../../../../packages/*/CHANGELOG.md',
    '../../../../modules/*/CHANGELOG.md',
    '../../../../deploy/CHANGELOG.md',
    '../../../../deploy/updater/CHANGELOG.md',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const KINDS: Readonly<Record<string, ChangeKind>> = {
  'major changes': 'major',
  'minor changes': 'minor',
  'patch changes': 'patch',
};

/** "- abc1234: Add the thing" → ["abc1234", "Add the thing"]. */
const ENTRY = /^- (?:([0-9a-f]{7,40}): )?(.*)$/;
const NOISE = /^(?:@bemmoly\/|updated dependencies)/i;

interface ParsedEntry {
  version: string;
  kind: ChangeKind;
  id: string;
  paragraphs: string[];
}

/** One CHANGELOG.md into its entries. Wrapped lines and blank-line paragraphs stay together. */
export function parseChangelog(source: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  let version: string | undefined;
  let kind: ChangeKind | undefined;
  let current: { id: string; lines: string[] } | undefined;
  const flush = () => {
    if (current && version && kind) {
      const text = current.lines.join('\n').trim();
      const paragraphs = text
        .split(/\n\s*\n/)
        .map((block) => {
          const lines = block.split('\n').map((line) => line.trim());
          if (!lines[0]?.startsWith('- ')) return lines.join(' ').trim();
          // A list: each "- " starts an item; wrapped lines join the item before them.
          return lines.join('\n').replace(/\n(?!- )/g, ' ');
        })
        .filter(Boolean);
      if (paragraphs.length > 0 && !NOISE.test(paragraphs[0] ?? '')) {
        entries.push({ version, kind, id: current.id, paragraphs });
      }
    }
    current = undefined;
  };
  for (const line of source.split('\n')) {
    const heading = /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      flush();
      if (heading[1] === '##') {
        version = heading[2]?.trim();
        kind = undefined;
      } else {
        kind = KINDS[heading[2]?.trim().toLowerCase() ?? ''];
      }
      continue;
    }
    const entry = ENTRY.exec(line);
    if (entry) {
      flush();
      const text = entry[2] ?? '';
      current = { id: entry[1] ?? text, lines: [text] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return entries;
}

/** Numeric semver order, newest first; a pre-release sorts below its release. */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => {
    const [core = '', pre] = version.split('-', 2);
    return { parts: core.split('.').map(Number), pre };
  };
  const [x, y] = [parse(a), parse(b)];
  for (let index = 0; index < 3; index += 1) {
    const diff = (y.parts[index] ?? 0) - (x.parts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === undefined) return -1;
  if (y.pre === undefined) return 1;
  return y.pre.localeCompare(x.pre, 'en', { numeric: true });
}

const ORDER: readonly ChangeKind[] = ['major', 'minor', 'patch'];

export function collectReleases(
  sources: readonly string[],
  dates: Readonly<Record<string, string>> = RELEASE_DATES,
  /** A version tagged but never published, and the release that shipped its notes. */
  unpublished: Readonly<Record<string, string>> = UNPUBLISHED,
): Release[] {
  const byVersion = new Map<string, Map<string, ReleaseChange>>();
  for (const source of sources) {
    // A release whose only notes are dependency bumps still shipped: the fixed group tags
    // every package, so it is the version the installer pulls even with nothing to list.
    for (const [, tagged] of source.matchAll(/^## (\S+)\s*$/gm)) {
      const version = tagged && (unpublished[tagged] ?? tagged);
      if (version && !byVersion.has(version)) byVersion.set(version, new Map());
    }
    for (const { version: tagged, kind, id, paragraphs } of parseChangelog(source)) {
      const version = unpublished[tagged] ?? tagged;
      const changes = byVersion.get(version) ?? new Map<string, ReleaseChange>();
      if (!changes.has(id)) changes.set(id, { kind, paragraphs });
      byVersion.set(version, changes);
    }
  }
  return [...byVersion.entries()]
    .map(([version, changes]) => ({
      version,
      date: dates[version] ?? null,
      changes: [...changes.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)),
    }))
    .sort((a, b) => compareVersions(a.version, b.version));
}

/**
 * The releases that are out: every version in the notes up to the newest published GitHub
 * release. The changesets tool writes a version's notes (and tags it) before the release
 * workflow publishes it, and a publish can fail, so notes alone would show a version nobody
 * can install. Without an answer from GitHub (offline, rate limited) every version counts.
 */
export function releasedOnly(releases: readonly Release[], published: string | null): Release[] {
  if (!published) return [...releases];
  return releases.filter((release) => compareVersions(release.version, published) >= 0);
}

/** The newest published release's version, asked once per build; null without an answer. */
export const PUBLISHED_VERSION = await fetchPublishedVersion();

/**
 * Every version with notes, published or not, newest first. Checks of what the notes say read
 * this, so they do not depend on whether GitHub had published the newest tag at build time.
 */
export const NOTED_RELEASES: readonly Release[] = collectReleases(Object.values(files));

/** Every released version in the repository's changelogs, newest first. */
export const RELEASES: readonly Release[] = releasedOnly(NOTED_RELEASES, PUBLISHED_VERSION);

/**
 * The newest release: the version the installer pulls today, and the one version every page,
 * the JSON-LD and llms.txt show (tests/version.test.ts). Nothing else in the site may hard-code
 * a version (tests/version-source.test.ts).
 */
export const LATEST: Release = latestOf(RELEASES);

function latestOf(releases: readonly Release[]): Release {
  const [latest] = releases;
  // A build with no release to name fails, rather than inventing a version.
  if (!latest) throw new Error('No released version in the changelogs');
  return latest;
}

/** "0.3.0" → "0.3": how the site names the release a feature arrived in. */
export const minorOf = (version: string) => version.split('.').slice(0, 2).join('.');

/** The oldest release in one changelog, such as a module's: the release it first shipped in. */
export function firstReleaseIn(path: string): string | null {
  const source = Object.entries(files).find(([file]) => file.endsWith(path))?.[1];
  if (!source) return null;
  const versions = [...source.matchAll(/^## (\S+)\s*$/gm)].flatMap((match) => match[1] ?? []);
  return versions.sort(compareVersions).at(-1) ?? null;
}

/**
 * The badge for a module that has shipped: "New in 0.3" while its release is the newest minor
 * or the one before, then plain "Available". Read from the changelogs, so it cannot go stale.
 */
export function shippedLabel(since: string | null): string {
  if (!since) return 'Available';
  const [major, minor] = LATEST.version.split('.').map(Number);
  const [sinceMajor, sinceMinor] = since.split('.').map(Number);
  const recent = major === sinceMajor && (minor ?? 0) - (sinceMinor ?? 0) <= 1;
  return recent ? `New in ${minorOf(since)}` : 'Available';
}

/** The release Docs first shipped in, from the module's own changelog. */
export const DOCS_SINCE = firstReleaseIn('modules/docs/CHANGELOG.md');

/** The release AI first shipped in: the oldest release whose notes open with "AI arrives". */
export const AI_SINCE =
  [...RELEASES]
    .reverse()
    .find((release) =>
      release.changes.some((change) => change.paragraphs[0]?.startsWith('AI arrives')),
    )?.version ?? null;

/** What is still to come, without release numbers (src/data/changelog.ts). */
export const UPCOMING = ROADMAP;

/** The changelogs read, from the repository root; the tests compare them with the repository. */
export const CHANGELOG_FILES: readonly string[] = Object.keys(files).map((path) =>
  posix.normalize(posix.join('apps/site/src/lib', path)),
);

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The little Markdown release notes use: `code`, **strong** and *emphasis*, escaped first. */
export function inlineMarkdown(text: string): string {
  // Odd pieces are code spans, so a `*` inside code is never read as emphasis.
  return text
    .split('`')
    .map((piece, index) =>
      index % 2 === 1
        ? `<code>${escapeHtml(piece)}</code>`
        : escapeHtml(piece)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>'),
    )
    .join('');
}

/** One paragraph of a note as HTML: a list when its lines are "- " items. */
export function paragraphHtml(paragraph: string): string {
  if (!paragraph.startsWith('- ')) return `<p>${inlineMarkdown(paragraph)}</p>`;
  const items = paragraph.split('\n').map((item) => `<li>${inlineMarkdown(item.slice(2))}</li>`);
  return `<ul>${items.join('')}</ul>`;
}

export const KIND_TITLES: Readonly<Record<ChangeKind, string>> = {
  major: 'Breaking changes',
  minor: 'New',
  patch: 'Fixes and improvements',
};

/** A release's changes under their headings, breaking changes first. */
export function groupByKind(changes: readonly ReleaseChange[]) {
  return ORDER.map((kind) => ({
    kind,
    title: KIND_TITLES[kind],
    changes: changes.filter((change) => change.kind === kind),
  })).filter((group) => group.changes.length > 0);
}

/** The anchor of a release on /changelog: v0-1-7, since ids keep to letters, digits and dashes. */
export const releaseId = (version: string) => `v${version.replace(/[^\w-]/g, '-')}`;
