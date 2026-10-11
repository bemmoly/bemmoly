import { NotFoundError } from '@bemmoly/shared';
import type { CollabDocumentDefinition } from '../../modules/collab.ts';
import type { FromModule } from '../../modules/registry.ts';

export type HostedDocument = FromModule<CollabDocumentDefinition>;

/** Ids are opaque to the kernel but never hold the separator, a slash or whitespace. */
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface ResolvedName {
  definition: HostedDocument;
  id: string;
}

/**
 * `<kind>:<id>` to the module definition that serves it. An unknown kind or a malformed id is
 * NotFound, so a probe learns nothing about which kinds exist.
 */
export function resolveDocumentName(
  name: string,
  documents: readonly HostedDocument[],
): ResolvedName {
  const separator = name.lastIndexOf(':');
  const kind = separator > 0 ? name.slice(0, separator) : '';
  const id = name.slice(separator + 1);
  const definition = documents.find((candidate) => candidate.kind === kind);
  if (!definition || !ID.test(id)) throw new NotFoundError('No such document');
  return { definition, id };
}
