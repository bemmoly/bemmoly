import type { BumpKind, ChangeList } from './changes.ts';
import type { ConfigChanges } from './config-changes.ts';
import { rollbackMode, type SchemaChange } from './schema-changes.ts';
import type { Release } from './version.ts';

export interface NotesInput {
  release: Release;
  changes: ChangeList;
  schema: readonly SchemaChange[];
  config: ConfigChanges;
  /** The application image, for the verification command. */
  image: string;
  /** owner/name on GitHub; the signing identity is this repository's release workflow. */
  repository: string;
  /** No earlier release: configuration is described as new rather than diffed. */
  firstRelease: boolean;
}

const KIND_TITLES = [
  ['major', 'Breaking changes'],
  ['minor', 'New'],
  ['patch', 'Fixes'],
] as const;

/**
 * 1.0.0 is the one major that breaks nothing: leaving 0.x is the stability declaration
 * (AGENTS.md §6), so its major note is the release's headline, not a breaking change.
 */
export function kindTitle(kind: BumpKind, release: Release): string {
  const [major, minor, patch] = release.version.split(/[.-]/).map(Number);
  if (kind === 'major' && major === 1 && minor === 0 && patch === 0) return 'Highlights';
  return KIND_TITLES.find(([each]) => each === kind)?.[1] ?? kind;
}

/** One note as a Markdown list item; later lines are indented so they stay inside it. */
const listItem = (text: string) =>
  text
    .split('\n')
    .map((line, index) => (index === 0 ? `- ${line}` : line === '' ? '' : `  ${line}`))
    .join('\n');

function changesSection(changes: ChangeList, release: Release): string[] {
  const lines: string[] = [];
  for (const [kind] of KIND_TITLES) {
    if (changes[kind].length === 0) continue;
    lines.push(`### ${kindTitle(kind, release)}`, '', ...changes[kind].map(listItem), '');
  }
  return lines.length > 0 ? lines : ['No user-visible changes.', ''];
}

function schemaSection(schema: readonly SchemaChange[]): string[] {
  if (schema.length === 0) return ['### Schema changes', '', 'None.', ''];
  const rows = schema.map((change) => {
    const flags = [
      change.slow ? '**slow on large tables**' : '',
      change.irreversible ? '**irreversible**' : '',
    ].filter(Boolean);
    const note = flags.length > 0 ? flags.join(', ') : 'reversible';
    return `| ${change.module} | \`${change.id}\` | ${change.description} | ${note} |`;
  });
  return [
    '### Schema changes',
    '',
    '| Module | Changeset | What it does | Notes |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

function configSection(config: ConfigChanges, firstRelease: boolean): string[] {
  if (firstRelease) {
    return [
      '### Configuration',
      '',
      'First release: every key is described in apps/server/.env.example.',
      '',
    ];
  }
  const lines = [
    ...config.added.map((key) => `- Added \`${key}\` (see apps/server/.env.example)`),
    ...config.removed.map((key) => `- Removed \`${key}\``),
  ];
  return ['### Configuration changes', '', ...(lines.length > 0 ? lines : ['None.']), ''];
}

function upgradeSection(input: NotesInput): string[] {
  const mode = rollbackMode(input.schema);
  const rollback =
    mode === 'code'
      ? 'Rolling back to the previous version is a code rollback: no data is lost.'
      : 'This release contains an irreversible changeset: rolling back needs a restore of the pre-update backup, which discards changes made after the update.';
  const slow = input.schema.filter((change) => change.slow).map((change) => `\`${change.id}\``);
  return [
    '### Before you update',
    '',
    `- ${rollback}`,
    ...(slow.length > 0
      ? [`- Expect a longer update on large workspaces: ${slow.join(', ')}.`]
      : []),
    `- Verify the image: \`cosign verify ${input.image}:${input.release.version} --certificate-identity-regexp '^https://github.com/${input.repository}/.github/workflows/release.yml@' --certificate-oidc-issuer https://token.actions.githubusercontent.com\``,
    '',
  ];
}

export function renderNotes(input: NotesInput): string {
  const channel = input.release.prerelease ? ' (beta channel)' : '';
  return [
    `## Bemmoly ${input.release.version}${channel}`,
    '',
    ...changesSection(input.changes, input.release),
    ...schemaSection(input.schema),
    ...configSection(input.config, input.firstRelease),
    ...upgradeSection(input),
  ].join('\n');
}
