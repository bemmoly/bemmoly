import type { RequestContext } from '@bemmoly/core';
import type {
  EnvironmentPathsResponse,
  EnvironmentsResponse,
} from '../../../../shared/environments.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { selectPaths } from './paths.ts';
import { selectEnvironments } from './read.ts';
import { createEnvironmentWrites } from './writes.ts';

/** Environments left to right, the path each tier takes through them, and their writes. */
export function createEnvironmentsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext): Promise<EnvironmentsResponse> {
      await authorizePipelines(ctx);
      return { items: await selectEnvironments(requireDatabase(deps)) };
    },

    async paths(ctx: RequestContext): Promise<EnvironmentPathsResponse> {
      await authorizePipelines(ctx);
      return { items: await selectPaths(requireDatabase(deps)) };
    },

    ...createEnvironmentWrites(deps),
  };
}

export type EnvironmentsService = ReturnType<typeof createEnvironmentsService>;
