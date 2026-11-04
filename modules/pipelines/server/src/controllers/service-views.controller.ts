import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import { listServicesQuerySchema } from '../../../shared/service-views.ts';
import type { ServiceViewsService } from '../services/service-views/index.ts';

/** Services, a service's versions and For you's summary. */
export function createServiceViewsController(service: ServiceViewsService) {
  return {
    list: (request: FastifyRequest) =>
      service.list(contextOf(request), parseOrThrow(listServicesQuerySchema, request.query)),
    one: (request: FastifyRequest) =>
      service.one(contextOf(request), parseOrThrow(applicationKeyParamsSchema, request.params).key),
    versions: (request: FastifyRequest) =>
      service.versions(
        contextOf(request),
        parseOrThrow(applicationKeyParamsSchema, request.params).key,
      ),
    forYou: (request: FastifyRequest) => service.forYou(contextOf(request)),
  };
}

export type ServiceViewsController = ReturnType<typeof createServiceViewsController>;
