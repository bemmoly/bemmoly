import { createHash } from 'node:crypto';
import type { Changeset } from '../../contracts/changelog.ts';

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Line endings are normalised so a Windows checkout hashes like a Linux one. */
export function checksumOfSource(source: string): string {
  return sha256(source.replace(/\r\n/g, '\n'));
}

/**
 * The checksum recorded in schema_changelog. Changesets loaded from a folder
 * hash their file; changesets declared inline (tests, generated code) hash
 * their metadata and the text of `up` and `down`.
 */
export function checksumOf(changeset: Changeset): string {
  if (changeset.source) return changeset.source.checksum;
  const metadata = JSON.stringify({
    id: changeset.id,
    author: changeset.author,
    description: changeset.description,
    contexts: changeset.contexts ?? ['*'],
    transactional: changeset.transactional ?? true,
    irreversible: changeset.irreversible ?? false,
  });
  return checksumOfSource(
    [metadata, changeset.up.toString(), changeset.down?.toString() ?? ''].join('\n'),
  );
}
