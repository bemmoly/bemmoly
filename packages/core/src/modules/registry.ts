import { moduleSettingsSchema, sidebarSectionSchema, type ModuleManifest } from '@bemmoly/shared';
import type { RetrievalSourceDefinition } from '../contracts/retrieval.ts';
import type { CodeActivityConsumer, CodeAppPermissions, CodeEventConsumer } from './code.ts';
import type { CollabDocumentDefinition } from './collab.ts';
import type { BemmolyModule } from './contract.ts';
import type { StartSourceDefinition } from './start.ts';
import type { FileTargetDefinition } from './files.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type { McpPromptDefinition, McpResourceDefinition } from './mcp.ts';
import type {
  AiContribution,
  AiExclusionSourceDefinition,
  CapabilityDefinition,
  EntityDefinition,
  ImporterDefinition,
  ReferenceSourceDefinition,
  RouteDefinition,
  SearchProviderDefinition,
} from './registries.ts';

export interface LoadedModule {
  module: BemmolyModule;
  contributions: ModuleContributions;
}

export type FromModule<T> = T & { moduleId: string };

/** The modules enabled for this process, in load (dependency) order. */
export class ModuleRegistry {
  readonly #loaded = new Map<string, LoadedModule>();

  add(module: BemmolyModule, contributions: ModuleContributions): void {
    if (this.#loaded.has(module.id)) {
      throw new ModuleLoadError(`Module "${module.id}" is registered twice`, module.id);
    }
    for (const route of contributions.routes) {
      const owner = this.routes().find((existing) => existing.prefix === route.prefix);
      if (owner) {
        throw new ModuleLoadError(
          `Module "${module.id}": route prefix "${route.prefix}" is already used by "${owner.moduleId}"`,
          module.id,
        );
      }
    }
    this.#loaded.set(module.id, { module, contributions });
  }

  has(id: string): boolean {
    return this.#loaded.has(id);
  }

  get(id: string): LoadedModule | undefined {
    return this.#loaded.get(id);
  }

  list(): LoadedModule[] {
    return [...this.#loaded.values()];
  }

  ids(): string[] {
    return [...this.#loaded.keys()];
  }

  manifests(): ModuleManifest[] {
    return this.list().map(({ module, contributions }) => ({
      id: module.id,
      name: module.name ?? module.id.charAt(0).toUpperCase() + module.id.slice(1),
      version: module.version,
      navigation: [...contributions.navigation],
      ...(module.icon ? { icon: module.icon } : {}),
      ...(module.color ? { color: module.color } : {}),
      ...(module.order === undefined ? {} : { order: module.order }),
      ...(module.sidebar ? { sidebar: sidebarSectionSchema.parse(module.sidebar) } : {}),
      ...(module.settings ? { settings: moduleSettingsSchema.parse(module.settings) } : {}),
      ...(module.surface ? { surface: module.surface } : {}),
      ...(contributions.searchProviders.length > 0
        ? {
            search: contributions.searchProviders.map(({ kind, label }) => ({ kind, label })),
          }
        : {}),
    }));
  }

  routes(): FromModule<RouteDefinition>[] {
    return this.#collect((c) => c.routes);
  }

  searchProviders(): FromModule<SearchProviderDefinition>[] {
    return this.#collect((c) => c.searchProviders);
  }

  collabDocuments(): FromModule<CollabDocumentDefinition>[] {
    return this.#collect((c) => c.collabDocuments);
  }

  fileTargets(): FromModule<FileTargetDefinition>[] {
    return this.#collect((c) => c.fileTargets);
  }

  entities(): FromModule<EntityDefinition>[] {
    return this.#collect((c) => c.entities);
  }

  referenceSources(): FromModule<ReferenceSourceDefinition>[] {
    return this.#collect((c) => c.referenceSources);
  }

  /** Each module's `summaryForUser`, for the start page. */
  startSources(): FromModule<StartSourceDefinition>[] {
    return this.#collect((c) => c.startSources);
  }

  retrievalSources(): FromModule<RetrievalSourceDefinition>[] {
    return this.#collect((c) => c.retrievalSources);
  }

  capabilities(): FromModule<CapabilityDefinition>[] {
    return this.#collect((c) => c.capabilities);
  }

  /** Every module's `ctx.ai.addTool` contributions; the plans service reads its tools here. */
  aiTools(): FromModule<AiContribution>[] {
    return this.#collect((c) => c.aiTools);
  }

  /** Prompt files modules registered with `ctx.ai.addPromptFile`; the prompt service loads them. */
  aiPromptFiles(): FromModule<{ name: string; path: string }>[] {
    return this.#collect((c) => c.aiPromptFiles);
  }

  /** Spaces and projects Settings › AI › Privacy can exclude, per module. */
  aiExclusionSources(): FromModule<AiExclusionSourceDefinition>[] {
    return this.#collect((c) => c.aiExclusionSources);
  }

  /** What modules offer MCP clients besides their AI tools. */
  mcpResources(): FromModule<McpResourceDefinition>[] {
    return this.#collect((c) => c.mcpResources);
  }

  mcpPrompts(): FromModule<McpPromptDefinition>[] {
    return this.#collect((c) => c.mcpPrompts);
  }

  mcpTools(): FromModule<AiContribution>[] {
    return this.#collect((c) => c.mcpTools);
  }

  /** Every module's `ctx.importers.add` contributions; Settings › Import offers these. */
  importers(): FromModule<ImporterDefinition>[] {
    return this.#collect((c) => c.importers);
  }

  /** Every module's `ctx.code.addConsumer` contributions; verified deliveries go to these. */
  codeConsumers(): FromModule<CodeActivityConsumer>[] {
    return this.#collect((c) => c.codeConsumers);
  }

  /** Every module's `ctx.code.addEventConsumer` contributions. */
  codeEventConsumers(): FromModule<CodeEventConsumer>[] {
    return this.#collect((c) => c.codeEventConsumers);
  }

  /** Every module's `ctx.code.requestAppPermissions` contributions, for the app manifest. */
  codeAppPermissions(): FromModule<CodeAppPermissions>[] {
    return this.#collect((c) => c.codeAppPermissions);
  }

  #collect<T extends object>(pick: (c: ModuleContributions) => readonly T[]): FromModule<T>[] {
    return this.list().flatMap(({ module, contributions }) =>
      pick(contributions).map((item) => ({ ...item, moduleId: module.id })),
    );
  }
}
