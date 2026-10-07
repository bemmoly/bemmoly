import type { ModuleManifest } from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { ModuleAccessResolver } from '../../contracts/module-access.ts';
import type { ModuleRegistry } from '../../modules/registry.ts';

export interface VisibleModulesOptions {
  /** Enabled ids; omitted means every loaded module. */
  enabled?: readonly string[];
  /** The person asking; module access filters by it when a resolver is wired. */
  actor?: Actor;
  access?: ModuleAccessResolver;
}

/** What the web shell boots from: enabled modules this person may see. */
export async function listModuleManifests(
  registry: ModuleRegistry,
  options: VisibleModulesOptions = {},
): Promise<ModuleManifest[]> {
  const enabled = options.enabled ? new Set(options.enabled) : undefined;
  const manifests = registry.manifests().filter((manifest) => !enabled || enabled.has(manifest.id));
  if (!options.actor || !options.access) return manifests;
  const allowed = await options.access.modulesFor(options.actor);
  return manifests.filter((manifest) => allowed.has(manifest.id));
}
