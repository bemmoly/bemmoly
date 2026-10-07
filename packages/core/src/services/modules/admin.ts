import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type AdminModule,
  type AdminModulesResponse,
} from '@bemmoly/shared';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { ChangesetContextName } from '../../contracts/changelog.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { ApplyModuleDefaultAccess } from '../../contracts/module-access.ts';
import type { ModuleDataBackup } from '../../contracts/module-backup.ts';
import type { ModuleRow } from '../../models/modules.ts';
import type { LoadedModule, ModuleRegistry } from '../../modules/registry.ts';
import type { RequestMeta } from '../audit/index.ts';
import type { KernelChangelogRunner } from '../changelog/index.ts';
import type { ModuleState } from './state.ts';
import type { ModuleStateStore } from './store.ts';

export const MANAGE_MODULES = 'workspace.modules.manage';

export interface ModuleAdminDeps {
  registry: ModuleRegistry;
  state: ModuleState;
  store: ModuleStateStore;
  runner?: KernelChangelogRunner;
  contexts: readonly ChangesetContextName[];
  authorize: Authorize;
  /** Writes the module's declared default grant; a no-op once it has grants. */
  applyDefaultAccess?: ApplyModuleDefaultAccess;
  backup?: ModuleDataBackup;
  events?: EventBus;
}

/** Settings › Modules: list, enable, disable and the separate, confirmed remove data. */
export interface ModuleAdmin {
  list(actor: Actor): Promise<AdminModulesResponse>;
  get(actor: Actor, id: string): Promise<AdminModule>;
  enable(actor: Actor, id: string, meta?: RequestMeta): Promise<AdminModule>;
  disable(actor: Actor, id: string, meta?: RequestMeta): Promise<AdminModule>;
  removeData(actor: Actor, id: string, confirm: string, meta?: RequestMeta): Promise<AdminModule>;
}

export function createModuleAdmin(deps: ModuleAdminDeps): ModuleAdmin {
  const { registry, state, store, runner } = deps;

  const authorize = (actor: Actor) => deps.authorize(actor, MANAGE_MODULES, { kind: 'workspace' });

  function writable(): void {
    if (state.isPinned()) {
      throw new ConflictError(
        'Modules are pinned by BEMMOLY_MODULES; change the environment instead',
        {
          details: { pinned: true },
        },
      );
    }
  }

  function loaded(id: string): LoadedModule {
    const found = registry.get(id);
    if (!found) throw new NotFoundError(`There is no module "${id}" in this image`);
    return found;
  }

  async function rowOf(id: string): Promise<ModuleRow | undefined> {
    return (await store.list()).find((row) => row.id === id);
  }

  /** Pending changesets per module, from one status read for all of them. */
  async function pendingCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!runner) return counts;
    const all = registry.ids();
    for (const item of await runner.status({ contexts: deps.contexts, modules: all })) {
      counts.set(item.module, (counts.get(item.module) ?? 0) + 1);
    }
    return counts;
  }

  function toView(entry: LoadedModule, row: ModuleRow | undefined, pending: number): AdminModule {
    const { module } = entry;
    return {
      id: module.id,
      name: module.name ?? module.id.charAt(0).toUpperCase() + module.id.slice(1),
      version: module.version,
      enabled: state.isEnabled(module.id),
      enabledAt: row?.enabledAt?.toISOString() ?? null,
      versionInstalled: row?.versionInstalled ?? null,
      changelogState: row?.changelogState ?? 'pending',
      pendingChangesets: pending,
      dependsOn: [...(module.dependsOn ?? [])],
      defaultAccess: module.defaultAccess,
      restartRequired: false,
    };
  }

  async function view(entry: LoadedModule, row: ModuleRow | undefined): Promise<AdminModule> {
    return toView(entry, row, (await pendingCounts()).get(entry.module.id) ?? 0);
  }

  async function changed(actor: Actor, id: string, kind: string): Promise<AdminModule> {
    await state.refresh();
    await state.announce(id);
    await deps.events?.publish({
      kind,
      occurredAt: new Date(),
      actor,
      entity: { kind: 'module', id },
      payload: { moduleId: id },
    });
    return view(loaded(id), await rowOf(id));
  }

  return {
    async list(actor) {
      await authorize(actor);
      const rows = new Map((await store.list()).map((row) => [row.id, row]));
      const pending = await pendingCounts();
      const items = registry
        .list()
        .map((entry) =>
          toView(entry, rows.get(entry.module.id), pending.get(entry.module.id) ?? 0),
        );
      return { items, pinned: state.isPinned() };
    },

    async get(actor, id) {
      await authorize(actor);
      return view(loaded(id), await rowOf(id));
    },

    async enable(actor, id, meta) {
      await authorize(actor);
      writable();
      const entry = loaded(id);
      if (state.isEnabled(id)) return view(entry, await rowOf(id));
      const missing = (entry.module.dependsOn ?? []).filter(
        (dependency) => !state.isEnabled(dependency),
      );
      if (missing.length > 0) {
        throw new ConflictError(`Enable ${missing.join(', ')} first`, { details: { missing } });
      }
      if (runner) {
        try {
          await runner.update({ contexts: deps.contexts, modules: [...state.enabledIds(), id] });
        } catch (error) {
          await store.upsert(id, { changelogState: 'failed' });
          throw error;
        }
      }
      await deps.applyDefaultAccess?.({ id, defaultAccess: entry.module.defaultAccess }, actor);
      await store.upsert(
        id,
        {
          enabled: true,
          enabledAt: new Date(),
          versionInstalled: entry.module.version,
          changelogState: 'current',
          dataRemovedAt: null,
        },
        { actor, action: 'module.enabled', ...(meta ? { meta } : {}) },
      );
      return changed(actor, id, 'module.enabled');
    },

    async disable(actor, id, meta) {
      await authorize(actor);
      writable();
      const entry = loaded(id);
      if (!state.isEnabled(id)) return view(entry, await rowOf(id));
      const dependents = registry
        .list()
        .filter((other) => state.isEnabled(other.module.id) && other.module.dependsOn?.includes(id))
        .map((other) => other.module.id);
      if (dependents.length > 0) {
        throw new ConflictError(`Disable ${dependents.join(', ')} first`, {
          details: { dependents },
        });
      }
      await store.upsert(
        id,
        { enabled: false, disabledAt: new Date() },
        { actor, action: 'module.disabled', ...(meta ? { meta } : {}) },
      );
      return changed(actor, id, 'module.disabled');
    },

    async removeData(actor, id, confirm, meta) {
      await authorize(actor);
      writable();
      loaded(id);
      if (confirm !== id) throw new ValidationError(`Type "${id}" to confirm removing its data`);
      if (state.isEnabled(id))
        throw new ConflictError('Disable the module before removing its data');
      if (!runner) throw new ConflictError('Removing data needs the database');
      const plan = await runner.rollbackPlan(id, { count: Number.MAX_SAFE_INTEGER });
      if (plan.irreversible.length > 0) {
        throw new ConflictError('Some changesets cannot be reversed; restore a backup instead', {
          details: { irreversible: plan.irreversible.map((step) => step.id) },
        });
      }
      if (!deps.backup)
        throw new ConflictError('A backup must run first, and backups are not configured');
      await deps.backup.backupBeforeRemoval({ moduleId: id, actor });
      await runner.rollback(id, { count: plan.steps.length });
      await store.upsert(
        id,
        {
          changelogState: 'removed',
          dataRemovedAt: new Date(),
          versionInstalled: null,
          enabledAt: null,
        },
        {
          actor,
          action: 'module.data_removed',
          details: { changesetsReversed: plan.steps.map((step) => step.id) },
          ...(meta ? { meta } : {}),
        },
      );
      return changed(actor, id, 'module.data_removed');
    },
  };
}
