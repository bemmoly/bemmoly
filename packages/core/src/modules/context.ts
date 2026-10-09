import { isCapabilityOfModule, navEntrySchema } from '@bemmoly/shared';
import type { SqlClient } from '../clients/postgres.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { EnqueueOptions, JobQueue } from '../contracts/jobs.ts';
import type { RealtimePublisher } from '../contracts/realtime.ts';
import type { BemmolyModule, ModuleContext } from './contract.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type { SettingsReader, SettingsRegistry } from './registries.ts';
import { createAuditRecorder } from '../services/audit/index.ts';

export interface ModuleContextOptions {
  events: EventBus;
  editorEnabled: boolean;
  /** Bound once the jobs service starts; sends before that fail loudly. */
  jobQueue?: JobQueue;
  /** Bound once the settings service exists; reads before that fail loudly. */
  settingsReader?: SettingsReader;
  realtime?: RealtimePublisher;
  database?: SqlClient;
}

/** The jobs service also reads a request id for its logs. */
type KernelEnqueueOptions = EnqueueOptions & { requestId?: string };

const noRealtime: RealtimePublisher = { publish: async () => undefined };

function ownsPath(moduleId: string, path: string): boolean {
  return path === `/${moduleId}` || path.startsWith(`/${moduleId}/`);
}

/** Builds the registries one module sees, recording into that module's contributions. */
export function createModuleContext(
  module: BemmolyModule,
  into: ModuleContributions,
  options: ModuleContextOptions,
): ModuleContext {
  const fail = (message: string): never => {
    throw new ModuleLoadError(`Module "${module.id}": ${message}`, module.id);
  };
  const settings: SettingsRegistry = {
    define(setting) {
      if (!setting.key.startsWith(`${module.id}.`)) {
        fail(`setting "${setting.key}" must be namespaced as "${module.id}.<name>"`);
      }
      into.settings.push(setting);
    },
    async get(key) {
      if (!key.startsWith(`${module.id}.`)) fail(`may only read its own settings, not "${key}"`);
      const reader = options.settingsReader;
      if (!reader) return fail('settings are not available in this process');
      return (await reader.read(key)) as never;
    },
  };
  return {
    routes: { add: (route) => into.routes.push(route) },
    entities: { add: (entity) => into.entities.push(entity) },
    links: { add: (link) => into.links.push(link) },
    capabilities: {
      add(capability) {
        if (!isCapabilityOfModule(capability.name, module.id)) {
          fail(`capability "${capability.name}" must be namespaced as "${module.id}.<action>"`);
        }
        into.capabilities.push(capability);
      },
    },
    navigation: {
      add(entry) {
        const parsed = navEntrySchema.safeParse(entry);
        if (!parsed.success) fail(`navigation entry "${entry.id}" is not valid`);
        if (entry.placement === 'top' && !ownsPath(module.id, entry.path)) {
          fail(`top navigation path "${entry.path}" must live under "/${module.id}"`);
        }
        into.navigation.push(entry);
      },
    },
    jobs: {
      add(job) {
        if (!job.name.startsWith(`${module.id}.`)) {
          fail(`job "${job.name}" must be namespaced as "${module.id}.<name>"`);
        }
        into.jobs.push(job);
      },
      async send(name, payload, sendOptions) {
        if (!name.startsWith(`${module.id}.`)) {
          fail(`may only send its own jobs ("${module.id}.<name>"), not "${name}"`);
        }
        if (!options.jobQueue) {
          throw new ModuleLoadError(
            `Module "${module.id}": jobs are not available in this process`,
            module.id,
          );
        }
        const enqueueOptions: KernelEnqueueOptions = {
          ...(sendOptions?.idempotencyKey ? { key: sendOptions.idempotencyKey } : {}),
          ...(sendOptions?.startAfter !== undefined ? { startAfter: sendOptions.startAfter } : {}),
          ...(sendOptions?.requestId ? { requestId: sendOptions.requestId } : {}),
        };
        return options.jobQueue.enqueue(name, payload ?? {}, enqueueOptions);
      },
    },
    events: options.events,
    search: {
      addIndexer: (indexer) => into.searchIndexers.push(indexer),
      addField: (field) => into.queryFields.push(field),
      addProvider(provider) {
        if (!provider.kind.startsWith(`${module.id}.`)) {
          fail(`search kind "${provider.kind}" must be namespaced as "${module.id}.<kind>"`);
        }
        into.searchProviders.push(provider);
      },
    },
    ai: {
      addTool: (tool) => into.aiTools.push(tool),
      addContextBuilder: (builder) => into.aiContextBuilders.push(builder),
      addInsightGenerator: (generator) => into.aiInsightGenerators.push(generator),
      addPromptFile: (prompt) => into.aiPromptFiles.push(prompt),
    },
    ...(options.editorEnabled
      ? {
          editor: {
            addNode: (node) => into.editorNodes.push(node),
            addSlashCommand: (command) => into.editorSlashCommands.push(command),
          },
        }
      : {}),
    importers: { add: (importer) => into.importers.push(importer) },
    settings,
    realtime: options.realtime ?? noRealtime,
    ...(options.database
      ? { database: options.database, audit: createAuditRecorder(options.database) }
      : {}),
  };
}
