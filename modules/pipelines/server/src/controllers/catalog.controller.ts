import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import {
  applicationFiltersSchema,
  applicationKeyParamsSchema,
  listApplicationsQuerySchema,
  listGroupsQuerySchema,
} from '../../../shared/catalog.ts';
import type { CatalogService } from '../services/catalog/index.ts';

/** Domains, groups and applications under /api/v1/pipelines. */
export function createCatalogController(service: CatalogService) {
  return {
    domains: (request: FastifyRequest) => service.domains(contextOf(request)),
    groups(request: FastifyRequest) {
      return service.groups(contextOf(request), parseOrThrow(listGroupsQuerySchema, request.query));
    },
    applications(request: FastifyRequest) {
      const query = parseOrThrow(listApplicationsQuerySchema, request.query);
      return service.applications(contextOf(request), query);
    },
    facets(request: FastifyRequest) {
      const filters = parseOrThrow(applicationFiltersSchema, request.query);
      return service.facets(contextOf(request), filters);
    },
    application(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return service.application(contextOf(request), key);
    },
  };
}

export type CatalogController = ReturnType<typeof createCatalogController>;
