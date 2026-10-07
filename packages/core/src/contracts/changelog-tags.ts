/** A named point in the changelog, e.g. the version an update is leaving. */
export interface ChangelogTag {
  name: string;
  appVersion: string;
  createdAt: Date;
  /** order_executed of the newest applied changeset when the tag was taken; 0 on an empty schema. */
  lastOrderExecuted: number;
}

/**
 * `bemmoly db tag <name>` and the lookups rollback planning needs. Implemented
 * by the changelog runner next to ChangelogRunner.
 */
export interface ChangelogTags {
  tag(name: string, appVersion: string): Promise<ChangelogTag>;
  /** Newest tag first; `prefix` filters, e.g. "pre-upgrade-". */
  latest(prefix?: string): Promise<ChangelogTag | null>;
}

/** What rollback planning needs to know about a changeset that ran after a tag. */
export interface ChangesetTraits {
  module: string;
  id: string;
  orderExecuted: number;
  hasDown: boolean;
  irreversible: boolean;
}
