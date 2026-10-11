/**
 * The headings a release's notes are listed under on /changelog and in the feed, one per kind
 * of change the changesets tool writes.
 */
import type { ChangeKind, ReleaseChange } from './changelog.ts';

const ORDER: readonly ChangeKind[] = ['major', 'minor', 'patch'];

export const KIND_TITLES: Readonly<Record<ChangeKind, string>> = {
  major: 'Breaking changes',
  minor: 'New',
  patch: 'Fixes and improvements',
};

/**
 * The heading over a kind of change. The first stable major (leaving 0.x) breaks nothing: its
 * major note is the release's headline (AGENTS.md §6), so it is not listed as breaking.
 */
export function kindTitle(kind: ChangeKind, version: string): string {
  const [major, minor, patch] = version.split(/[.-]/).map(Number);
  if (kind === 'major' && major === 1 && minor === 0 && patch === 0) return 'Highlights';
  return KIND_TITLES[kind];
}

/** A release's changes under their headings, breaking changes (or highlights) first. */
export function groupByKind(changes: readonly ReleaseChange[], version: string) {
  return ORDER.map((kind) => ({
    kind,
    title: kindTitle(kind, version),
    changes: changes.filter((change) => change.kind === kind),
  })).filter((group) => group.changes.length > 0);
}
