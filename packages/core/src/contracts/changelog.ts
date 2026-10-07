import type { SQL } from 'drizzle-orm';

/** Install contexts the runner starts with; `*` runs everywhere. */
export type ChangesetContextName = 'production' | 'demo' | 'test' | '*' | (string & {});

export type PreconditionFailAction = 'halt' | 'markRan' | 'skip' | 'warn';

export type PreconditionCheck =
  | { tableExists: { table: string } }
  | { columnExists: { table: string; column: string } }
  | { indexExists: { index: string; table?: string } }
  | { rowCount: { table: string; where?: SQL; expected: number | { min?: number; max?: number } } }
  | { sqlCheck: { query: SQL; expected: string | number | boolean | null } };

export type Precondition = PreconditionCheck & {
  onFail: PreconditionFailAction;
  reason?: string;
};

export interface BackfillOptions {
  batch: number;
}

export interface BackfillRow {
  id: string;
}

/** What a changeset's `up` and `down` receive from the runner. */
export interface ChangesetContext {
  exec(statement: SQL): Promise<void>;
  query<Row extends Record<string, unknown>>(statement: SQL): Promise<Row[]>;
  /** Batched, resumable data transform; progress is logged on the changelog row. */
  backfill<Row extends BackfillRow>(
    table: string,
    options: BackfillOptions,
    handle: (rows: Row[]) => Promise<void>,
  ): Promise<void>;
  /** Kernel services a code changeset may call, e.g. to re-extract page text. */
  services: Readonly<Record<string, unknown>>;
  log(message: string): void;
}

export interface ValidChecksum {
  checksum: string;
  reason: string;
}

export interface Changeset {
  /** Stable; must match the file name, e.g. "0007-issue-rank". */
  id: string;
  author: string;
  description: string;
  preconditions?: readonly Precondition[];
  contexts?: readonly ChangesetContextName[];
  /** false for statements such as CREATE INDEX CONCURRENTLY. Defaults to true. */
  transactional?: boolean;
  up(ctx: ChangesetContext): Promise<void>;
  /** Required for DDL-only changesets; omit and set `irreversible` when data is lost. */
  down?(ctx: ChangesetContext): Promise<void>;
  irreversible?: boolean;
  /** Old checksums accepted for an already-run changeset, each with the reason it changed. */
  validChecksums?: readonly ValidChecksum[];
  /** Re-run on every boot, e.g. a view maintained from source. */
  runAlways?: boolean;
  /** Re-run when the checksum changes instead of failing validation. */
  runOnChange?: boolean;
}

/** Ordered changesets of one module (or the kernel), ordered by numeric id prefix. */
export type Changelog = readonly Changeset[];

/** Identity helper so changeset files are type-checked against the contract. */
export function changeset(definition: Changeset): Changeset {
  return definition;
}

export type ChangesetState = 'ran' | 'marked_ran' | 'rolled_back' | 'started';

export interface ChangelogEntry {
  module: string;
  id: string;
  author: string;
  checksum: string;
  executedAt: Date;
  executionMs: number;
  orderExecuted: number;
  appVersion: string;
  contexts: readonly string[];
  state: ChangesetState;
}

export interface PendingChangeset {
  module: string;
  id: string;
}

export interface ChangelogValidationProblem {
  module: string;
  id: string;
  problem: 'checksum_mismatch' | 'duplicate_id' | 'gap_in_order' | 'missing_down';
  message: string;
}

export interface ChangelogRunOptions {
  contexts: readonly ChangesetContextName[];
  modules?: readonly string[];
}

export type ChangelogRollbackTarget = { toId: string } | { count: number };

/** The kernel's changelog runner, applied under one advisory lock per run. */
export interface ChangelogRunner {
  validate(): Promise<ChangelogValidationProblem[]>;
  status(): Promise<PendingChangeset[]>;
  update(options: ChangelogRunOptions): Promise<ChangelogEntry[]>;
  rollback(module: string, target: ChangelogRollbackTarget): Promise<ChangelogEntry[]>;
  history(module?: string): Promise<ChangelogEntry[]>;
}
