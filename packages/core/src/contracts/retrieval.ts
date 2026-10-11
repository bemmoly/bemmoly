import type { RequestContext } from '../services/authz/index.ts';

/**
 * Where in its record a chunk sits, so a citation opens the right place: a page heading
 * (`anchor` is the heading's id in the read view), an issue's description or one comment.
 * `label` is what the citation shows ("Rollout plan", "Description", "Comment").
 */
export interface RetrievalLocation {
  label: string;
  anchor?: string;
  part?: 'body' | 'description' | 'comment';
  commentId?: string;
}

/** One embeddable piece of a record, with the person who wrote it (for opt-outs). */
export interface RetrievalChunk {
  text: string;
  location: RetrievalLocation;
  authorId: string | null;
}

/** A record as the retrieval index sees it: its chunks plus where it lives and opens. */
export interface RetrievalDocument {
  id: string;
  title: string;
  /** Where the record opens in the web app; a chunk's anchor is appended as a fragment. */
  path: string;
  /** The container the access filter and the exclusion list name. */
  containerId: string;
  chunks: readonly RetrievalChunk[];
}

/**
 * A module's indexable content for "Ask your docs" and ⌘K questions: Docs pages by heading,
 * Work issues as description plus comments. The kernel embeds what `load` returns, stores it
 * with the container for access filtering, and asks `visible` before anything reaches a model,
 * so a person never retrieves a chunk the API would not show them.
 */
export interface RetrievalSourceDefinition {
  /** Namespaced by module and equal to its ⌘K search kind: "docs.page", "work.issue". */
  kind: string;
  /** How answers count it: "from 3 pages, 2 issues". */
  noun: { one: string; other: string };
  /** Which container `containerId` names; exclusions are listed per container kind. */
  container: 'space' | 'project';
  /**
   * The realtime kinds whose ids are this source's records changing (content, place or
   * trash), so the index follows the module without the module knowing about it.
   */
  changeKinds: readonly string[];
  /** Ids of every live record after `after` (keyset, id order), for a backfill. */
  list(input: { after: string | null; limit: number }): Promise<readonly string[]>;
  /** The records that exist and are live; an id left out is gone and its chunks are dropped. */
  load(ids: readonly string[]): Promise<readonly RetrievalDocument[]>;
  /** The containers the person may read, or null for all of them (admins, system). */
  readableContainers(ctx: RequestContext): Promise<readonly string[] | null>;
  /** Of these records, the ones the person may open, checked as the module's API checks. */
  visible(ctx: RequestContext, ids: readonly string[]): Promise<ReadonlySet<string>>;
}

export interface RetrievalRegistry {
  addRetrievalSource(source: RetrievalSourceDefinition): void;
}
