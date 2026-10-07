/**
 * Collects the release-note entries for one version from the CHANGELOG.md files the
 * changesets tool writes per package. The fixed group bumps every package together, so
 * one entry can appear in several files; it is listed once.
 */

export type BumpKind = 'major' | 'minor' | 'patch';

export type ChangeList = Record<BumpKind, string[]>;

const HEADING_KIND: Readonly<Record<string, BumpKind>> = {
  'major changes': 'major',
  'minor changes': 'minor',
  'patch changes': 'patch',
};

/** "- abc1234: Add the thing" and "- Add the thing" both become "Add the thing". */
const ENTRY = /^- (?:[0-9a-f]{7,40}: )?(.*)$/;

function sectionFor(changelog: string, version: string): string[] {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

function entriesOf(section: string[]): Array<[BumpKind, string]> {
  const entries: Array<[BumpKind, string]> = [];
  let kind: BumpKind | undefined;
  let current: string[] | undefined;
  const flush = () => {
    if (kind && current) entries.push([kind, current.join('\n').trim()]);
    current = undefined;
  };
  for (const line of section) {
    const heading = /^### (.+)$/.exec(line)?.[1]?.toLowerCase();
    if (heading !== undefined) {
      flush();
      kind = HEADING_KIND[heading];
      continue;
    }
    const entry = ENTRY.exec(line);
    if (entry) {
      flush();
      current = [entry[1] ?? ''];
    } else if (current && /^\s{2,}\S/.test(line)) {
      current.push(line.trim());
    } else if (line.trim() === '') {
      flush();
    }
  }
  flush();
  return entries.filter(([, text]) => !/^updated dependencies/i.test(text));
}

export function collectChanges(changelogs: readonly string[], version: string): ChangeList {
  const changes: ChangeList = { major: [], minor: [], patch: [] };
  const seen = new Set<string>();
  for (const changelog of changelogs) {
    for (const [kind, text] of entriesOf(sectionFor(changelog, version))) {
      if (seen.has(text)) continue;
      seen.add(text);
      changes[kind].push(text);
    }
  }
  return changes;
}
