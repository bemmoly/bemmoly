import type { CapabilityName, NavEntry, SearchResult } from '@bemmoly/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { z } from 'zod';
import type { SettingDefinition, SettingKey, SettingsKeys } from '../contracts/settings.ts';
import type { RequestContext } from '../services/authz/index.ts';

export interface RouteDefinition {
  /** Mounted under /api/v1, e.g. "/issues". */
  prefix: `/${string}`;
  plugin: FastifyPluginAsync;
}

export interface RouteRegistry {
  add(route: RouteDefinition): void;
}

export interface EntitySummary {
  kind: string;
  id: string;
  key?: string;
  title: string;
  path: string;
  /**
   * Facts a renderer shows beside the title, owned by the serving module and
   * passed through untouched: an issue's status, type and priority.
   */
  data?: Record<string, unknown>;
}

export interface SearchDocument {
  kind: string;
  id: string;
  title: string;
  body: string;
  containerId?: string;
}

/** A record named by its id or by its human key ("PLT-204"). */
export type EntityLookup = { id: string } | { key: string };

export interface EntityDefinition {
  kind: string;
  renderer: string;
  resolve(ref: EntityLookup): Promise<EntitySummary | null>;
  /**
   * Many records by id or key in one round trip, for lists. With a context,
   * only those the person may open. Without it the registry falls back to
   * resolve and canView per record.
   */
  resolveMany?(refs: readonly EntityLookup[], ctx?: RequestContext): Promise<EntitySummary[]>;
  /** Whether the person behind the request may open the record. */
  canView(ctx: RequestContext, id: string): Promise<boolean>;
  buildSearchDocument?(id: string): Promise<SearchDocument | null>;
}

export interface EntityRegistry {
  add(entity: EntityDefinition): void;
  /**
   * Resolves a record any enabled module registered, so one module can name another's records
   * without importing it. With a request context the result is only what that person may see;
   * without one it is a trusted server-side lookup (a background job reading a document). Null
   * when no enabled module serves the kind or the record is not there.
   */
  resolve(kind: string, ref: EntityLookup, ctx?: RequestContext): Promise<EntitySummary | null>;
  /**
   * resolve for a list: the records found, each at most once, in no set
   * order; the ones the person may not open are left out. Empty when no
   * enabled module serves the kind.
   */
  resolveMany(
    kind: string,
    refs: readonly EntityLookup[],
    ctx?: RequestContext,
  ): Promise<EntitySummary[]>;
  /** Whether an enabled module serves the kind, so callers can keep a placeholder otherwise. */
  has(kind: string): boolean;
}

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
}

export interface ReferenceGroup {
  source: string;
  label: string;
  moduleId: string;
  items: EntitySummary[];
}

export interface LinkRegistry {
  add(link: LinkKindDefinition): void;
  addReferenceSource(source: ReferenceSourceDefinition): void;
  /** Every enabled module's references to the target, one group per source that has any. */
  referencesTo(ctx: RequestContext, target: ReferenceTarget): Promise<ReferenceGroup[]>;
}

/** Columns of the roles matrix in the People mock. */
export type SystemRole = 'org_admin' | 'project_admin' | 'member' | 'viewer' | 'contractor';

export interface CapabilityDefinition {
  name: CapabilityName;
  label: string;
  description?: string;
  group: string;
  defaults: Readonly<Record<SystemRole, boolean>>;
}

export interface CapabilityRegistry {
  add(capability: CapabilityDefinition): void;
}

export interface NavRegistry {
  add(entry: NavEntry): void;
}

export interface JobContext {
  jobId: string;
  signal: AbortSignal;
  /** The request that enqueued the job, or the job id for scheduled runs. */
  requestId?: string;
}

export interface JobDefinition {
  /** Namespaced by owner: "system.housekeeping", "sample.ping". */
  name: string;
  handle(payload: unknown, ctx: JobContext): Promise<void>;
  /** Cron expression for scheduled jobs. */
  schedule?: string;
  /** A setting holding the cron expression; wins over `schedule` and follows its changes. */
  scheduleSetting?: string;
  retryLimit?: number;
  /** At most one run at a time across every worker (pg-boss "singleton" policy). */
  singleton?: boolean;
  /** How long one run may take before pg-boss retries it. Defaults to 15 minutes. */
  expireInSeconds?: number;
  retryDelaySeconds?: number;
  /** Exponential backoff between retries; defaults to true. */
  retryBackoff?: boolean;
  /** Handlers of this job running at once in one process; defaults to 1. */
  concurrency?: number;
}

export interface SendJobOptions {
  /** Stable per piece of work; a repeat within 24 hours is dropped and returns null. */
  idempotencyKey?: string;
  /** Run no earlier than this time, or this many seconds from now. */
  startAfter?: Date | number;
  /** Carried into the handler's logs so a job can be traced to its request. */
  requestId?: string;
}

export interface JobRegistry {
  add(job: JobDefinition): void;
  /** Enqueues one of this module's own jobs through the kernel's JobQueue. */
  send(
    name: string,
    payload?: Record<string, unknown>,
    options?: SendJobOptions,
  ): Promise<string | null>;
}

export interface SearchIndexerDefinition {
  kind: string;
  build(id: string): Promise<SearchDocument | null>;
}

export interface QueryFieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'user' | 'enum';
  entityKinds: readonly string[];
}

/** What a provider is asked: the words typed and how many results its group may show. */
export interface SearchProviderQuery {
  q: string;
  limit: number;
}

/**
 * Answers ⌘K for one kind of the module's records. The kernel calls it only
 * for people with access to the module, with their request context, so the
 * provider applies its own container rules (project membership, say) as it
 * does for its own endpoints. Results carry their own href into the module.
 */
export interface SearchProviderDefinition {
  /** Namespaced by module: "work.issue". */
  kind: string;
  /** The palette group and scope its results show under: "Issues". */
  label: string;
  search(
    ctx: RequestContext,
    query: SearchProviderQuery,
  ): Promise<Omit<SearchResult, 'kind' | 'group'>[]>;
}

export interface SearchRegistry {
  addIndexer(indexer: SearchIndexerDefinition): void;
  addField(field: QueryFieldDefinition): void;
  addProvider(provider: SearchProviderDefinition): void;
}

export interface AiContribution {
  name: string;
  description: string;
  definition: unknown;
}

export interface AiRegistry {
  addTool(tool: AiContribution): void;
  addContextBuilder(builder: AiContribution): void;
  addInsightGenerator(generator: AiContribution): void;
  addPromptFile(prompt: { name: string; path: string }): void;
}

export interface EditorContribution {
  name: string;
  definition: unknown;
}

export interface EditorRegistry {
  addNode(node: EditorContribution): void;
  addSlashCommand(command: EditorContribution): void;
}

export interface ImporterDefinition {
  id: string;
  label: string;
  definition: unknown;
}

export interface ImporterRegistry {
  add(importer: ImporterDefinition): void;
}

export interface SettingsRegistry {
  define<Schema extends z.ZodType>(
    setting: SettingDefinition<z.output<Schema>> & { schema: Schema },
  ): void;
  /** Reads one of this module's own settings (decrypted, validated, cached). */
  get<Key extends SettingKey>(key: Key): Promise<SettingsKeys[Key]>;
}

/** What ctx.settings.get reads through; bound once the settings service exists. */
export interface SettingsReader {
  read(key: string): Promise<unknown>;
}
