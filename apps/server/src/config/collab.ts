import {
  createCollabHost,
  createRequestAuthorization,
  type CollabHandle,
  type CollabHost,
  type Database,
  type ModuleCatalog,
  type ModuleRegistry,
  type ModuleState,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';

export interface CollabWiringInput {
  env: Pick<Env, 'BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES' | 'BEMMOLY_COLLAB_MAX_MESSAGE_BYTES'>;
  db: Database;
  /** Every module in the image; the host serves the kinds they registered. */
  modules: ModuleRegistry;
  /** Enabled modules, as authorization sees them. */
  catalog: ModuleCatalog;
  moduleState: ModuleState;
  /** The handle modules were loaded with; bound to the host here. */
  handle: CollabHandle;
  logger: Logger;
}

/**
 * The collaboration host on the API's own HTTP server: one per process, serving every
 * module's document kinds, with a fresh authorization cache per person it checks.
 */
export function wireCollab(input: CollabWiringInput): CollabHost {
  const { env } = input;
  const host = createCollabHost({
    documents: () => input.modules.collabDocuments(),
    contextFor: (actor) => ({
      actor,
      authz: createRequestAuthorization({ db: input.db, modules: input.catalog }),
    }),
    isEnabled: (moduleId) => input.moduleState.isEnabled(moduleId),
    logger: input.logger.child({ component: 'collab' }),
    limits: {
      ...(env.BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES !== undefined
        ? { messagesPerWindow: env.BEMMOLY_RATE_LIMIT_COLLAB_MESSAGES }
        : {}),
      ...(env.BEMMOLY_COLLAB_MAX_MESSAGE_BYTES !== undefined
        ? { maxMessageBytes: env.BEMMOLY_COLLAB_MAX_MESSAGE_BYTES }
        : {}),
    },
  });
  input.handle.bind(host);
  return host;
}
