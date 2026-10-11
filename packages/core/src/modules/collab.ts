import type { Doc } from 'yjs';
import type { Actor } from '../contracts/authz.ts';
import type { RequestContext } from '../services/authz/index.ts';

/** What a person may do with an open document: edit it, watch it, or not open it at all. */
export type CollabAccess = 'write' | 'read' | 'deny';

/** One debounced change notice: the document as it is now and who changed it since the last. */
export interface CollabChange {
  id: string;
  /** The live document. Read it; never write to it from here. */
  doc: Doc;
  /** People who changed it since the previous notice, in order of first change. */
  editors: readonly Actor[];
}

/**
 * A kind of collaborative document a module serves over /collab. The Hocuspocus document
 * name is `<kind>:<id>`. The kernel authenticates the socket, checks the module is enabled
 * and the person has access to it, then asks `authorize`; it persists every update through
 * `store` in order and calls `onChange` once edits settle.
 */
export interface CollabDocumentDefinition {
  /** Namespaced by module: "docs.page". */
  kind: string;
  /** Checked once per connection, with the person's request context; throwing denies. */
  authorize(ctx: RequestContext, id: string): Promise<CollabAccess>;
  /** The stored document as one Yjs update, or null when it has none yet. */
  load(id: string): Promise<Uint8Array | null>;
  /**
   * Persists an update (consecutive updates by one actor arrive merged). Calls for one
   * document never overlap and arrive in the order the server applied them. `actor` is null
   * for changes the server made without one.
   */
  store(id: string, update: Uint8Array, actor: Actor | null): Promise<void>;
  /** Runs once the document has been quiet for the debounce (2 s), and on unload and shutdown. */
  onChange?(change: CollabChange): Promise<void>;
}

/** What a module sees as `ctx.collab`. */
export interface CollabRegistry {
  add(definition: CollabDocumentDefinition): void;
  /**
   * Changes one of this module's documents from the server: live, so open editors see it,
   * and persisted like any other update. Loads the document when nobody has it open.
   */
  transact(kind: string, id: string, change: (doc: Doc) => void, actor?: Actor): Promise<void>;
}

/** The running host behind `transact`, bound once the server creates it. */
export interface CollabTransactor {
  transact(name: string, change: (doc: Doc) => void, actor: Actor | null): Promise<void>;
}

/** The Hocuspocus document name of a module document. */
export const collabDocumentName = (kind: string, id: string) => `${kind}:${id}`;
