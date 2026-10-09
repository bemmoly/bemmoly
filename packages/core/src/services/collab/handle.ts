import type { CollabTransactor } from '../../modules/collab.ts';

/**
 * A CollabTransactor handed to modules before the collaboration host exists (modules load
 * first, because the host serves their document kinds) and bound once it does.
 */
export interface CollabHandle extends CollabTransactor {
  bind(host: CollabTransactor): void;
}

export function createCollabHandle(): CollabHandle {
  let target: CollabTransactor | undefined;
  return {
    bind(host) {
      target = host;
    },
    transact(name, change, actor) {
      if (!target) {
        return Promise.reject(
          new Error(`Cannot change "${name}": the collab host has not started`),
        );
      }
      return target.transact(name, change, actor);
    },
  };
}
