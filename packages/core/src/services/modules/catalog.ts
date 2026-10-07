import type { ModuleRegistry } from '../../modules/registry.ts';
import type { ModuleCatalog } from '../authz/index.ts';
import type { ModuleState } from './state.ts';

type EnabledSet = Pick<ModuleState, 'enabledIds' | 'isEnabled'>;

/**
 * What authorization sees of the modules: the enabled ones and their
 * capabilities. Identity and the realtime hub are wired before the modules are
 * loaded and before the kernel creates the module state, so both are bound
 * late. The registry holds every module in the image; once the module state is
 * bound it decides which are enabled. Without a database there is no state and
 * the registry, already filtered by BEMMOLY_MODULES, answers alone.
 */
export interface EnabledModuleCatalog extends ModuleCatalog {
  bindRegistry(registry: ModuleRegistry): void;
  bindState(state: EnabledSet): void;
}

export function createEnabledModuleCatalog(): EnabledModuleCatalog {
  let registry: ModuleRegistry | undefined;
  let state: EnabledSet | undefined;
  const loaded = (): ModuleRegistry => {
    if (!registry) throw new Error('The module catalog was used before the modules were loaded');
    return registry;
  };
  return {
    bindRegistry(bound) {
      registry = bound;
    },
    bindState(bound) {
      state = bound;
    },
    ids: () => (state ? state.enabledIds() : loaded().ids()),
    capabilities: () =>
      loaded()
        .capabilities()
        .filter((capability) => !state || state.isEnabled(capability.moduleId)),
  };
}
