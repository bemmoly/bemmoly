import type { RequestContext } from '../services/authz/index.ts';
import type { EntitySummary } from './registries.ts';

/*
 * ctx.links: the link kinds modules declare and the reference sources that answer "what of
 * yours points at this record?", one record at a time or many of one kind at once.
 */

export interface LinkKindDefinition {
  kind: string;
  label: string;
  fromKinds: readonly string[];
  toKinds: readonly string[];
}

/** The other end of a reference, as the module that owns it describes it. */
export interface ReferenceTarget {
  kind: string;
  id: string;
}

/**
 * A module's answer to "what of yours points at this record?": Docs answers with the pages
 * that mention or embed an issue. Results are already filtered to what the person may see.
 */
export interface ReferenceSourceDefinition {
  /** Namespaced by module: "docs.page". */
  kind: string;
  /** What the group is called next to the record: "Linked docs". */
  label: string;
  referencesTo(ctx: RequestContext, target: ReferenceTarget): Promise<EntitySummary[]>;
  /**
   * The same question for many records of one kind in one go, by record id, so a list that
   * shows references per row (cards on a board) never asks once per row. Optional; a source
   * without it is left out of such lists.
   */
  referencesToMany?(
    ctx: RequestContext,
    targets: ReferenceTargets,
  ): Promise<ReadonlyMap<string, EntitySummary[]>>;
}

/** Many records of one kind, as a list asks about them. */
export interface ReferenceTargets {
  kind: string;
  ids: readonly string[];
}

export interface ReferenceGroup {
  source: string;
  label: string;
  moduleId: string;
  items: EntitySummary[];
}

/** One source's answer for many records: each record id with what points at it. */
export interface ReferenceGroupMany {
  source: string;
  label: string;
  moduleId: string;
  items: ReadonlyMap<string, EntitySummary[]>;
}

export interface LinkRegistry {
  add(link: LinkKindDefinition): void;
  addReferenceSource(source: ReferenceSourceDefinition): void;
  /** Every enabled module's references to the target, one group per source that has any. */
  referencesTo(ctx: RequestContext, target: ReferenceTarget): Promise<ReferenceGroup[]>;
  /** The same for many records of one kind, one call per source that answers in one go. */
  referencesToMany(ctx: RequestContext, targets: ReferenceTargets): Promise<ReferenceGroupMany[]>;
}
