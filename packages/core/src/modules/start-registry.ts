import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';
import type { StartRegistry } from './start.ts';

/** `ctx.start` for one module: at most one start page source. */
export function createStartRegistry(moduleId: string, into: ModuleContributions): StartRegistry {
  return {
    add(source) {
      if (into.startSources.length > 0) {
        throw new ModuleLoadError(
          `Module "${moduleId}": may add only one start page source`,
          moduleId,
        );
      }
      into.startSources.push(source);
    },
  };
}
