/**
 * Schema changesets added since the previous release, read from the changelog folders
 * (packages/core/changelog and modules/<id>/changelog), with the two facts an admin
 * needs before updating: does it take long on large tables, and can it be rolled back.
 */

const CHANGESET_FILE =
  /^(packages\/core|modules\/([a-z0-9-]+))\/changelog\/(\d{4}-[a-z0-9-]+)\.ts$/;

export interface SchemaChange {
  module: string;
  id: string;
  description: string;
  /** Marked `slow: true`, or runs a backfill or outside a transaction. */
  slow: boolean;
  /** Marked `irreversible: true`, or has no `down`: rollback needs a restore. */
  irreversible: boolean;
}

export function isChangesetFile(path: string): boolean {
  return CHANGESET_FILE.test(path) && !path.endsWith('.test.ts');
}

const DESCRIPTION = /description:\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/;

export function describeChangeset(path: string, source: string): SchemaChange {
  const match = CHANGESET_FILE.exec(path);
  if (!match) throw new Error(`${path} is not a changeset file`);
  const description = DESCRIPTION.exec(source)?.[2]?.replace(/\s+/g, ' ').trim() ?? '';
  return {
    module: match[2] ?? 'core',
    id: match[3] ?? '',
    description,
    slow:
      /\bslow:\s*true\b/.test(source) ||
      /\.backfill\s*[(<]/.test(source) ||
      /\btransactional:\s*false\b/.test(source),
    irreversible: /\birreversible:\s*true\b/.test(source) || !/\bdown\s*[(:]/.test(source),
  };
}

/** Code rollback keeps everyone's data; restore rollback is needed once anything is irreversible. */
export function rollbackMode(changes: readonly SchemaChange[]): 'code' | 'restore' {
  return changes.some((change) => change.irreversible) ? 'restore' : 'code';
}
