import type { Logger } from '../../config/logger.ts';
import type { ChangesetContextName } from '../../contracts/changelog.ts';
import type { Unsubscribe } from '../../contracts/event-bus.ts';
import type { RealtimeMessage, RealtimePublisher } from '../../contracts/realtime.ts';
import { ModuleLoadError } from '../../modules/errors.ts';
import type { ModuleRegistry } from '../../modules/registry.ts';
import type { KernelChangelogRunner } from '../changelog/index.ts';
import type { ModuleStateStore } from './store.ts';

export const MODULES_CHANGED = 'modules.changed';

export type EnabledListener = (enabled: readonly string[]) => Promise<void> | void;

export interface ModuleStateDeps {
  /** Every module in the image, registered at boot so enabling needs no restart. */
  registry: ModuleRegistry;
  store: ModuleStateStore;
  /** Absent without a database: nothing is migrated. */
  runner?: KernelChangelogRunner;
  contexts: readonly ChangesetContextName[];
  /** BEMMOLY_MODULES: when set, the enabled set is exactly this and read-only. */
  pinned: readonly string[];
  realtime?: RealtimePublisher;
  logger: Logger;
}

/** Which modules are enabled right now in this process, kept current across replicas. */
export interface ModuleState {
  /** Boot: reconcile the table with the image and the pin, and migrate enabled modules. */
  initialize(options: { migrate: boolean }): Promise<void>;
  enabledIds(): string[];
  isEnabled(id: string): boolean;
  isPinned(): boolean;
  /** Re-read the table, then tell listeners (jobs) the new set. */
  refresh(): Promise<void>;
  /** Tell every process (including this one) to refresh. */
  announce(moduleId: string): Promise<void>;
  onChange(listener: EnabledListener): Unsubscribe;
  handleRealtime(message: RealtimeMessage): Promise<void>;
}

function checkDependencies(registry: ModuleRegistry, enabled: ReadonlySet<string>): void {
  for (const id of enabled) {
    for (const dependency of registry.get(id)?.module.dependsOn ?? []) {
      if (!enabled.has(dependency)) {
        throw new ModuleLoadError(
          `Module "${id}" is enabled but depends on "${dependency}", which is not`,
          id,
        );
      }
    }
  }
}

export function createModuleState(deps: ModuleStateDeps): ModuleState {
  const { registry, store, logger } = deps;
  const listeners = new Set<EnabledListener>();
  let enabled = new Set<string>();

  const ordered = () => registry.ids().filter((id) => enabled.has(id));

  async function load(): Promise<void> {
    const rows = await store.list();
    enabled = new Set(
      rows.filter((row) => row.enabled && registry.has(row.id)).map((row) => row.id),
    );
    for (const listener of listeners) await listener(ordered());
  }

  async function reconcile(): Promise<void> {
    const rows = new Map((await store.list()).map((row) => [row.id, row]));
    for (const id of deps.pinned) {
      if (!registry.has(id))
        throw new ModuleLoadError(`BEMMOLY_MODULES names "${id}", which is not in this image`, id);
    }
    for (const id of registry.ids()) {
      const row = rows.get(id);
      // Without a pin, a module runs only once an admin enables it, on a fresh
      // install as much as for one a later image adds: nothing is on by default.
      const want = deps.pinned.length > 0 ? deps.pinned.includes(id) : (row?.enabled ?? false);
      if (row && row.enabled === want) continue;
      await store.upsert(
        id,
        want
          ? { enabled: true, enabledAt: new Date() }
          : { enabled: false, ...(row ? { disabledAt: new Date() } : {}) },
      );
    }
  }

  return {
    async initialize({ migrate }) {
      await reconcile();
      await load();
      checkDependencies(registry, enabled);
      if (!deps.runner) return;
      const ids = ordered();
      if (migrate) {
        await deps.runner.update({ contexts: deps.contexts, modules: ids });
      }
      const pending = new Set(
        (await deps.runner.status({ contexts: deps.contexts, modules: ids })).map((p) => p.module),
      );
      for (const id of ids) {
        const version = registry.get(id)?.module.version ?? null;
        await store.upsert(id, {
          changelogState: pending.has(id) ? 'pending' : 'current',
          versionInstalled: version,
        });
      }
      logger.info({ enabled: ids, pinned: deps.pinned.length > 0 }, 'modules ready');
    },
    enabledIds: ordered,
    isEnabled: (id) => enabled.has(id),
    isPinned: () => deps.pinned.length > 0,
    refresh: load,
    async announce(moduleId) {
      await deps.realtime?.publish({ kind: MODULES_CHANGED, ids: [moduleId] });
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async handleRealtime(message) {
      if (message.kind === MODULES_CHANGED) await load();
    },
  };
}
