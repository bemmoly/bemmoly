import type {
  ImportDiscovery,
  ImportField,
  ImportInclude,
  ImportOption,
  ImportPlan,
} from '@bemmoly/shared';
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
  /** When the mapping was last written: when an import last brought this in. */
  updatedAt?: string;
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

/** A container as the kernel hands it back to its importer: enough to find it at the source. */
export interface ImportContainerRef {
  id: string;
  key: string | null;
  name: string;
  kind: string;
  /** Records inside it, when counted. */
  count: number | null;
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

/** Where the plan sends one container, as the run reads it. */
export interface ImportRunTarget {
  mode: 'create' | 'existing' | 'update';
  key: string;
  id: string | null;
}

/**
 * How the kernel finds the projects or spaces a module's import writes into, to check a new
 * key is free and an existing target is still there.
 */
export interface ImportTargetLookup {
  /** "Work project", "Docs space". */
  label: string;
  /** "project", "space". */
  container: string;
  /** "issues", "pages". */
  records: string;
  /** The key a source key becomes here when nobody picks one. */
  keyFrom(sourceKey: string): string;
  byKeys(keys: readonly string[]): Promise<{ id: string; key: string; name: string }[]>;
  byIds(ids: readonly string[]): Promise<{ id: string; key: string; name: string }[]>;
  /** Projects or spaces whose key or name holds `q`, for the Existing picker. */
  search(q: string, limit: number): Promise<{ id: string; key: string; name: string }[]>;
}

/** A chosen container as a run works through it. */
export interface ImportRunContainer extends ImportContainerRef {
  target: ImportRunTarget | null;
}

/** One container's own checkpoint and progress, inside ctx.containers.run. */
export interface ImportContainerScope {
  checkpoint: {
    read<T>(): T | null;
    save(value: unknown): Promise<void>;
  };
  progress: {
    /** Names the step it is on and how many records it holds; its bar never goes back. */
    phase(name: string, total: number): Promise<void>;
    advance(by?: number): Promise<void>;
  };
}

export interface ImportRunContext extends ImportPlanContext {
  jobId: string;
  /** What to bring along with the records, as the plan settled it. */
  include: ImportInclude;
  /** Where each chosen container goes, by source id; empty for plans made before targets. */
  targets: ReadonlyMap<string, ImportRunTarget>;
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
  /**
   * The chosen containers, each run on its own: an error in one is recorded on it (in plain
   * words) and the run moves on to the next, so one failed project never fails the others.
   */
  containers: {
    /** Those still to do in this run, in the source's order. */
    list(): Promise<ImportRunContainer[]>;
    /** Those done, in this run or an earlier one of the same job. */
    done(): Promise<ImportRunContainer[]>;
    /**
     * Runs work for one container. Returns false when it failed (or had failed). With
     * `final: false` it is a first pass (a page tree before bodies) and stays to do.
     */
    run(
      container: ImportRunContainer,
      work: (scope: ImportContainerScope) => Promise<void>,
      options?: { final?: boolean },
    ): Promise<boolean>;
  };
  users: {
    /** The Bemmoly user id; null for a person with neither email nor name. */
    match(person: ImportPerson): Promise<string | null>;
  };
  files: {
    store(input: { bytes: Uint8Array; contentType: string }): Promise<StoredImportFile>;
    /**
     * An image as a served file of a module's file target (a page), so content can show it
     * at fileUrl(id). Null when the bytes are not an image the files service accepts.
     */
    storeImage(input: {
      bytes: Uint8Array;
      name: string;
      target: { kind: string; id: string };
    }): Promise<string | null>;
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
  /** The words for what it holds, for the chooser: "project", "projects", "issues". */
  nouns?: { container: string; containers: string; records: string; target: string };
  /**
   * Tests the connection and lists what is there, quickly: counts may be left null for
   * count() to fill in on demand. Marks what an earlier import of the site made (through the
   * mappings) and containers whose key is already taken here.
   */
  discover(connection: ImportConnection, ctx: ImportPlanContext): Promise<ImportDiscovery>;
  /** Where the app opens what a container went into, by its key: "/work/board/PLT". */
  targetPath?(key: string): string;
  /** The "what to bring" checkboxes this source offers. */
  options?: readonly ImportOption[];
  /** Where its containers can go; without it every container is new. */
  targets?: ImportTargetLookup;
  /** Everyone the chosen containers name, for the plan's people pass. */
  people?(
    connection: ImportConnection,
    containers: readonly ImportContainerRef[],
    ctx: ImportSourceContext,
  ): Promise<ImportPerson[]>;
  /** Counts the records in these containers; at most 100 at a time. */
  count?(
    connection: ImportConnection,
    containers: readonly ImportContainerRef[],
    ctx: ImportSourceContext,
  ): Promise<Record<string, number>>;
  /** What a run would do with these containers (counted, in the source's order). */
  plan(
    connection: ImportConnection,
    containers: readonly ImportContainerRef[],
    ctx: ImportPlanContext,
  ): Promise<ImportPlan>;
  /** Idempotent and resumable: reads the checkpoint, writes mappings as it goes. */
  run(connection: ImportConnection, plan: ImportPlan, ctx: ImportRunContext): Promise<void>;
}
