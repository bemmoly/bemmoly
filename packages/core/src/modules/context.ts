import type { PdfRenderer } from '../contracts/pdf.ts';
import { isCapabilityOfModule, navEntrySchema } from '@bemmoly/shared';
import type { SqlClient } from '../clients/postgres.ts';
import type { AiFacade } from '../contracts/ai.ts';
import type { EventBus } from '../contracts/event-bus.ts';
import type { EnqueueOptions, JobQueue } from '../contracts/jobs.ts';
import type { RealtimePublisher } from '../contracts/realtime.ts';
import { collabDocumentName, type CollabTransactor } from './collab.ts';
import type { CodeHostDirectory } from './code.ts';
import { createCodeRegistry } from './code-registry.ts';
import type { ActorContextFactory, BemmolyModule, ModuleContext } from './contract.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type { FileStoreAccess } from './files.ts';
import type { ObjectStore } from '../contracts/object-store.ts';
import { createModuleObjects } from './objects.ts';
import { createReferenceRegistries } from './references.ts';
import type { SettingsReader, SettingsRegistry } from './registries.ts';
import type { ModuleRegistry } from './registry.ts';
import { createDisabledAi } from '../services/ai/index.ts';
import { createAuditRecorder } from '../services/audit/index.ts';
import { createContainerMemberships } from '../services/authz/index.ts';

export interface ModuleContextOptions {
  events: EventBus;
  editorEnabled: boolean;
  /** Bound once the jobs service starts; sends before that fail loudly. */
  jobQueue?: JobQueue;
  /** Bound once the settings service exists; reads before that fail loudly. */
  settingsReader?: SettingsReader;
  realtime?: RealtimePublisher;
  database?: SqlClient;
  /** Bound once the collaboration host exists; server edits before that fail loudly. */
  collab?: CollabTransactor;
  /** The AI facade, read on every call so it can be bound after modules register. */
  ai?: () => AiFacade | undefined;
  /** The files service, read on every call so it can be bound after modules register. */
  files?: () => FileStoreAccess | undefined;
  /** The object store, read on every call so it can be bound after modules register. */
  objects?: () => ObjectStore | undefined;
  /** Every enabled module, for cross-module lookups; answers once loading finishes. */
  peers?: () => ModuleRegistry | undefined;
  /**
   * The live module state. Every module in the image registers, but a module's event
   * handlers run only while it is enabled: a disabled module's tables may not exist yet.
   */
  isEnabled?: (moduleId: string) => boolean;
  /** Builds the context a job acts in for an actor; present with a database. */
  contextFor?: ActorContextFactory;
  /** The connected code hosts, read on every call so they can be bound after modules register. */
  codeHosts?: () => CodeHostDirectory | undefined;
  /** The optional PDF renderer; absent unless one is configured. */
  pdf?: PdfRenderer;
  publicUrl?: string;
}

/** `ctx.events` for one module: it publishes freely, and hears events only while enabled. */
function createModuleEvents(
  moduleId: string,
  events: EventBus,
  isEnabled: ((moduleId: string) => boolean) | undefined,
): EventBus {
  if (!isEnabled) return events;
  return {
    publish: (event) => events.publish(event),
    subscribe: (kind, handler) =>
      events.subscribe(kind, async (event) => {
        if (isEnabled(moduleId)) await handler(event);
      }),
  };
}

/** The jobs service also reads a request id for its logs. */
type KernelEnqueueOptions = EnqueueOptions & { requestId?: string };

const noRealtime: RealtimePublisher = { publish: async () => undefined };

function ownsPath(moduleId: string, path: string): boolean {
  return path === `/${moduleId}` || path.startsWith(`/${moduleId}/`);
}

const disabledAi = createDisabledAi();

/** `ctx.ai`: registries recorded into the module's contributions, calls through the facade. */
function createModuleAi(
  moduleId: string,
  into: ModuleContributions,
  bound: (() => AiFacade | undefined) | undefined,
): ModuleContext['ai'] {
  const facade = () => bound?.() ?? disabledAi;
  return {
    addRetrievalSource(source) {
      if (!source.kind.startsWith(`${moduleId}.`)) {
        throw new ModuleLoadError(
          `Module "${moduleId}": retrieval kind "${source.kind}" must be namespaced as "${moduleId}.<kind>"`,
          moduleId,
        );
      }
      into.retrievalSources.push(source);
    },
    addTool: (tool) => into.aiTools.push(tool),
    addContextBuilder: (builder) => into.aiContextBuilders.push(builder),
    addInsightGenerator: (generator) => into.aiInsightGenerators.push(generator),
    addPromptFile: (prompt) => into.aiPromptFiles.push(prompt),
    addExclusionSource: (source) => into.aiExclusionSources.push(source),
    generate: (input) => facade().generate(input),
    stream: (input) => facade().stream(input),
    embed: (input) => facade().embed(input),
    enabled: (actor) => facade().enabled(actor),
    policy: (actor) => facade().policy(actor),
    assertAvailable: (role, actor) => facade().assertAvailable(role, actor),
    maySend: (scope, actor) => facade().maySend(scope, actor),
    renderPrompt: (id, variables) => facade().renderPrompt(id, variables),
    embeddingModel: () => facade().embeddingModel(),
  };
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
  const filesOf = () => options.files?.() ?? fail('files are not available in this process');
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
    ...createReferenceRegistries(into, options.peers ?? (() => undefined)),
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
          ...(sendOptions?.transaction ? { transaction: sendOptions.transaction } : {}),
        };
        return options.jobQueue.enqueue(name, payload ?? {}, enqueueOptions);
      },
    },
    events: createModuleEvents(module.id, options.events, options.isEnabled),
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
    ai: createModuleAi(module.id, into, options.ai),
    mcp: {
      addResource(resource) {
        if (!resource.name.startsWith(`${module.id}.`)) {
          fail(`MCP resource "${resource.name}" must be namespaced as "${module.id}.<name>"`);
        }
        if (!resource.uriTemplate.startsWith(`bemmoly://${module.id}/`)) {
          fail(`MCP resource "${resource.name}" must live under "bemmoly://${module.id}/"`);
        }
        into.mcpResources.push(resource);
      },
      addPrompt(prompt) {
        if (!prompt.name.startsWith(`${module.id}.`)) {
          fail(`MCP prompt "${prompt.name}" must be namespaced as "${module.id}.<name>"`);
        }
        into.mcpPrompts.push(prompt);
      },
      addTool: (tool) => into.mcpTools.push(tool),
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
    collab: {
      add(definition) {
        if (!definition.kind.startsWith(`${module.id}.`)) {
          fail(`collab kind "${definition.kind}" must be namespaced as "${module.id}.<kind>"`);
        }
        if (!/^[a-z][a-z0-9.-]*$/.test(definition.kind)) {
          fail(`collab kind "${definition.kind}" may hold only a-z, 0-9, dots and dashes`);
        }
        into.collabDocuments.push(definition);
      },
      async transact(kind, id, change, actor) {
        if (!kind.startsWith(`${module.id}.`)) {
          fail(`may only change its own documents ("${module.id}.<kind>"), not "${kind}"`);
        }
        if (!options.collab) {
          throw new ModuleLoadError(
            `Module "${module.id}": collaboration is not available in this process`,
            module.id,
          );
        }
        await options.collab.transact(collabDocumentName(kind, id), change, actor ?? null);
      },
    },
    files: {
      addTarget(definition) {
        if (!definition.kind.startsWith(`${module.id}.`)) {
          fail(`file target "${definition.kind}" must be namespaced as "${module.id}.<kind>"`);
        }
        into.fileTargets.push(definition);
      },
      read: (ctx, fileId) => filesOf().read(ctx, fileId),
      stat: (ctx, fileId) => filesOf().stat(ctx, fileId),
      upload(ctx, query, body) {
        if (!query.target.startsWith(`${module.id}.`)) {
          fail(`may only upload into its own file targets, not "${query.target}"`);
        }
        return filesOf().upload(ctx, query, body);
      },
      createUploadLink(ctx, query) {
        if (!query.target.startsWith(`${module.id}.`)) {
          fail(`may only hand out links into its own file targets, not "${query.target}"`);
        }
        return filesOf().createUploadLink(ctx, query);
      },
    },
    objects: createModuleObjects(module.id, options.objects),
    code: createCodeRegistry(module.id, into, options.codeHosts),
    realtime: options.realtime ?? noRealtime,
    ...(options.contextFor ? { contextFor: options.contextFor } : {}),
    ...(options.pdf ? { pdf: options.pdf } : {}),
    ...(options.publicUrl ? { publicUrl: options.publicUrl } : {}),
    ...(options.database
      ? {
          database: options.database,
          audit: createAuditRecorder(options.database),
          memberships: createContainerMemberships(options.database),
        }
      : {}),
  };
}
