import type { ImportDiscovery, ImportField, ImportPlan } from '@bemmoly/shared';
import type { SqlExecutor } from './sql.ts';

/*
 * The importer capability: one implementation per source, registered by the module that owns
 * what it writes (Work brings issues in, Docs brings pages in) through ctx.importers. The
 * kernel runs it as a resumable job and hands it everything that is not about the source:
 * the mapping table that makes a re-run update instead of duplicate, a checkpoint to resume
 * from, progress, the report of what was skipped, people matched by email, file storage, and
 * an outbound fetch that honours the install's address policy.
 */

/** The connection form's values, secrets decrypted; only the importer reads them. */
export type ImportConnection = Readonly<Record<string, string>>;

/** Which addresses a source's calls may reach: a hosted site, or one on the local network. */
export type ImportAddressPolicy = 'public' | 'local';

export interface ImportSourceContext {
  signal: AbortSignal;
  /** A fetch checked against the address policy on every call; redirects are refused. */
  fetchFor(policy: ImportAddressPolicy): typeof fetch;
}

export interface ImportMappingRow {
  targetId: string;
  meta: Record<string, unknown>;
}

/** External ids to Bemmoly ids, per job site, so a re-run finds what the last one made. */
export interface ImportMappingStore {
  get(kind: string, sourceId: string): Promise<ImportMappingRow | null>;
  getMany(kind: string, sourceIds: readonly string[]): Promise<Map<string, ImportMappingRow>>;
  /** Every mapping of a kind; for kinds with few rows (statuses, labels). */
  all(kind: string): Promise<Map<string, ImportMappingRow>>;
  set(
    kind: string,
    sourceId: string,
    targetId: string,
    meta?: Record<string, unknown>,
    executor?: SqlExecutor,
  ): Promise<void>;
  setMany(
    kind: string,
    rows: readonly { sourceId: string; targetId: string; meta?: Record<string, unknown> }[],
    executor?: SqlExecutor,
  ): Promise<void>;
}

export interface ImportPlanContext extends ImportSourceContext {
  mappings: ImportMappingStore;
}

/** A person at the source, matched by email to a Bemmoly user or made a placeholder. */
export interface ImportPerson {
  sourceId: string;
  email: string | null;
  name: string;
}

export interface StoredImportFile {
  storageKey: string;
  sha256: string;
  size: number;
}

export type ImportOutcome = 'created' | 'updated' | 'skipped';

export interface ImportRunContext extends ImportPlanContext {
  jobId: string;
  /** The admin who started the run, the author of what has no author at the source. */
  actorUserId: string | null;
  checkpoint: {
    read<T>(): T | null;
    save(value: unknown): Promise<void>;
  };
  progress: {
    /** Starts a named step of `total` records; the bar resets. */
    phase(name: string, total: number): Promise<void>;
    advance(by?: number): Promise<void>;
  };
  report: {
    count(kind: string, outcome: ImportOutcome, by?: number): void;
    skip(kind: string, source: string, reason: string): void;
    warn(message: string): void;
  };
  users: {
    /** The Bemmoly user id; null for a person with neither email nor name. */
    match(person: ImportPerson): Promise<string | null>;
  };
  files: {
    store(input: { bytes: Uint8Array; contentType: string }): Promise<StoredImportFile>;
  };
}

export interface Importer {
  id: string;
  label: string;
  description: string;
  brings: readonly string[];
  fields: readonly ImportField[];
  /** Stable for one source, so mappings of two sites never mix: "https://acme.example.net". */
  siteOf(connection: ImportConnection): string;
  /** Tests the connection and counts what is there; throws a typed error it can explain. */
  discover(connection: ImportConnection, ctx: ImportSourceContext): Promise<ImportDiscovery>;
  plan(
    connection: ImportConnection,
    containers: readonly string[],
    ctx: ImportPlanContext,
  ): Promise<ImportPlan>;
  /** Idempotent and resumable: reads the checkpoint, writes mappings as it goes. */
  run(connection: ImportConnection, plan: ImportPlan, ctx: ImportRunContext): Promise<void>;
}
