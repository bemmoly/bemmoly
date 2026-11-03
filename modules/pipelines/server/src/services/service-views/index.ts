import type { RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  ForYouSummary,
  ListServicesQuery,
  ServiceResponse,
  ServicesResponse,
  ServiceVersionsResponse,
} from '../../../../shared/service-views.ts';
import {
  authorizePipelines,
  personOf,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { forYouSummary } from './for-you.ts';
import { listServices } from './list.ts';
import { listVersions } from './versions.ts';

/**
 * The reads behind Services, a service's page and For you: built from pipeline_current, the
 * releases and the open change requests, and gated like every Pipelines read. They change
 * nothing.
 */
export function createServiceViewsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext, query: ListServicesQuery): Promise<ServicesResponse> {
      await authorizePipelines(ctx);
      return listServices(requireDatabase(deps), query, personOf(ctx.actor));
    },
    async one(ctx: RequestContext, key: string): Promise<ServiceResponse> {
      await authorizePipelines(ctx);
      const found = await listServices(requireDatabase(deps), {}, personOf(ctx.actor), key);
      const service = found.items[0];
      if (!service) throw new NotFoundError(`No service called "${key}"`);
      return { environments: found.environments, service };
    },
    async versions(ctx: RequestContext, key: string): Promise<ServiceVersionsResponse> {
      await authorizePipelines(ctx);
      return listVersions(requireDatabase(deps), key);
    },
    async forYou(ctx: RequestContext): Promise<ForYouSummary> {
      await authorizePipelines(ctx);
      return forYouSummary(requireDatabase(deps), requirePerson(ctx.actor));
    },
  };
}

export type ServiceViewsService = ReturnType<typeof createServiceViewsService>;
