import { isModuleId } from '@bemmoly/shared';
import semver from 'semver';
import type { EventBus } from '../contracts/event-bus.ts';
import type { SqlClient } from '../clients/postgres.ts';
import type { JobQueue } from '../contracts/jobs.ts';
import type { RealtimePublisher } from '../contracts/realtime.ts';
import type { CollabTransactor } from './collab.ts';
import type { BemmolyModule } from './contract.ts';
import { createModuleContext } from './context.ts';
import { emptyContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import { createLocalEventBus } from './local-event-bus.ts';
import type { SettingsReader } from './registries.ts';
import { ModuleRegistry } from './registry.ts';

/** The kernel API version modules declare compatibility against in `coreApi`. */
export const CORE_API_VERSION = '0.1.0';

export interface LoadModulesOptions {
  /** Every module shipped in this image. */
  available: readonly BemmolyModule[];
  /** Ids to enable; empty or omitted enables every available module. */
  enabled?: readonly string[];
  events?: EventBus;
  editorEnabled?: boolean;
  coreApiVersion?: string;
  /** What ctx.jobs.send enqueues through; see services/jobs createJobQueueHandle. */
  jobQueue?: JobQueue;
  /** What ctx.settings.get reads through; bind it to the settings service. */
  settingsReader?: SettingsReader;
  realtime?: RealtimePublisher;
  database?: SqlClient;
  /** What ctx.collab.transact goes through; see services/collab createCollabHandle. */
  collab?: CollabTransactor;
}

function indexAvailable(available: readonly BemmolyModule[]): Map<string, BemmolyModule> {
  const byId = new Map<string, BemmolyModule>();
  for (const module of available) {
    if (!isModuleId(module.id))
      throw new ModuleLoadError(`"${module.id}" is not a valid module id`);
    if (byId.has(module.id)) throw new ModuleLoadError(`Module "${module.id}" is listed twice`);
    byId.set(module.id, module);
  }
  return byId;
}

/** Dependency order, stable with respect to the requested order; fails on cycles. */
export function orderByDependencies(modules: readonly BemmolyModule[]): BemmolyModule[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const ordered: BemmolyModule[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (module: BemmolyModule, path: string[]): void => {
    if (state.get(module.id) === 'done') return;
    if (state.get(module.id) === 'visiting') {
      throw new ModuleLoadError(`Module dependency cycle: ${[...path, module.id].join(' -> ')}`);
    }
    state.set(module.id, 'visiting');
    for (const dependencyId of module.dependsOn ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new ModuleLoadError(
          `Module "${module.id}" depends on "${dependencyId}", which is not enabled`,
          module.id,
        );
      }
      visit(dependency, [...path, module.id]);
    }
    state.set(module.id, 'done');
    ordered.push(module);
  };
  for (const module of modules) visit(module, []);
  return ordered;
}

/** Validates the enabled set, then calls each module's register() in dependency order. */
export function loadModules(options: LoadModulesOptions): ModuleRegistry {
  const available = indexAvailable(options.available);
  const coreApiVersion = options.coreApiVersion ?? CORE_API_VERSION;
  const requested = options.enabled?.length ? options.enabled : [...available.keys()];
  const enabled = requested.map((id) => {
    const module = available.get(id);
    if (!module) throw new ModuleLoadError(`Module "${id}" is enabled but not in this image`, id);
    if (!semver.satisfies(coreApiVersion, module.coreApi)) {
      throw new ModuleLoadError(
        `Module "${id}" needs kernel API ${module.coreApi}; this kernel is ${coreApiVersion}`,
        id,
      );
    }
    return module;
  });
  const registry = new ModuleRegistry();
  const events = options.events ?? createLocalEventBus();
  for (const module of orderByDependencies(enabled)) {
    const contributions = emptyContributions();
    module.register(
      createModuleContext(module, contributions, {
        events,
        editorEnabled: options.editorEnabled ?? false,
        ...(options.jobQueue ? { jobQueue: options.jobQueue } : {}),
        ...(options.settingsReader ? { settingsReader: options.settingsReader } : {}),
        ...(options.realtime ? { realtime: options.realtime } : {}),
        ...(options.database ? { database: options.database } : {}),
        ...(options.collab ? { collab: options.collab } : {}),
        peers: () => registry,
      }),
    );
    registry.add(module, contributions);
  }
  return registry;
}
