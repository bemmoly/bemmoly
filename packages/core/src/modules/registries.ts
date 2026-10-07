import type { CapabilityName, NavEntry } from '@bemmoly/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { z } from 'zod';
import type { Actor } from '../contracts/authz.ts';
import type { SettingDefinition } from '../contracts/settings.ts';

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
}

export interface SearchDocument {
  kind: string;
  id: string;
  title: string;
  body: string;
  containerId?: string;
}

export interface EntityDefinition {
  kind: string;
  renderer: string;
  resolve(ref: { id: string } | { key: string }): Promise<EntitySummary | null>;
  canView(actor: Actor, id: string): Promise<boolean>;
  buildSearchDocument?(id: string): Promise<SearchDocument | null>;
}

export interface EntityRegistry {
  add(entity: EntityDefinition): void;
}

export interface LinkKindDefinition {
  kind: string;
  label: string;
  fromKinds: readonly string[];
  toKinds: readonly string[];
}

export interface LinkRegistry {
  add(link: LinkKindDefinition): void;
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
}

export interface JobDefinition {
  name: string;
  handle(payload: unknown, ctx: JobContext): Promise<void>;
  /** Cron expression for scheduled jobs. */
  schedule?: string;
  retryLimit?: number;
}

export interface JobRegistry {
  add(job: JobDefinition): void;
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

export interface SearchRegistry {
  addIndexer(indexer: SearchIndexerDefinition): void;
  addField(field: QueryFieldDefinition): void;
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
}
