import { isCapabilityOfModule, navEntrySchema } from '@bemmoly/shared';
import type { EventBus } from '../contracts/event-bus.ts';
import type { BemmolyModule, ModuleContext } from './contract.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type { SettingsRegistry } from './registries.ts';

export interface ModuleContextOptions {
  events: EventBus;
  editorEnabled: boolean;
}

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
    jobs: { add: (job) => into.jobs.push(job) },
    events: options.events,
    search: {
      addIndexer: (indexer) => into.searchIndexers.push(indexer),
      addField: (field) => into.queryFields.push(field),
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
  };
}
