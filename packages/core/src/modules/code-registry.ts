import type { CodeHostDirectory, CodeRegistry } from './code.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';

/** `ctx.code` for one module: its consumers and permission requests, and the hosts, bound late. */
export function createCodeRegistry(
  moduleId: string,
  into: ModuleContributions,
  codeHosts: (() => CodeHostDirectory | undefined) | undefined,
): CodeRegistry {
  const namespaced = (kind: string, id: string) => {
    if (!id.startsWith(`${moduleId}.`)) {
      throw new ModuleLoadError(
        `Module "${moduleId}": ${kind} "${id}" must be namespaced as "${moduleId}.<name>"`,
        moduleId,
      );
    }
  };
  return {
    addConsumer(consumer) {
      namespaced('code consumer', consumer.id);
      into.codeConsumers.push(consumer);
    },
    addEventConsumer(consumer) {
      namespaced('code event consumer', consumer.id);
      into.codeEventConsumers.push(consumer);
    },
    requestAppPermissions(request) {
      into.codeAppPermissions.push(request);
    },
    hosts: () => {
      const directory = () => {
        const bound = codeHosts?.();
        if (!bound) {
          throw new ModuleLoadError(
            `Module "${moduleId}": code hosts are not available in this process`,
            moduleId,
          );
        }
        return bound;
      };
      return {
        clientFor: async (repository) => directory().clientFor(repository),
        repositories: async () => directory().repositories(),
      };
    },
  };
}
