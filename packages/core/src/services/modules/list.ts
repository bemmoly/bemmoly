import type { ModuleManifest } from '@bemmoly/shared';
import type { ModuleRegistry } from '../../modules/registry.ts';

/** Enabled modules for the web shell. Filtering by module grant arrives with authz. */
export function listModuleManifests(registry: ModuleRegistry): ModuleManifest[] {
  return registry.manifests();
}
