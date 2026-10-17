import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema, domainKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  createApplicationBodySchema,
  createDomainBodySchema,
  createGroupBodySchema,
  dependenciesBodySchema,
  groupParamsSchema,
  listCatalogChangesQuerySchema,
  updateApplicationBodySchema,
  updateDomainBodySchema,
  updateGroupBodySchema,
} from '../../../shared/catalog-writes.ts';
import type { CatalogWritesService } from '../services/catalog-writes/index.ts';

/** Catalog writes under /api/v1/pipelines: domains, groups, applications, catalog changes. */
export function createCatalogWritesController(service: CatalogWritesService) {
  const created = async <T>(reply: FastifyReply, work: Promise<T>) => {
    const value = await work;
    reply.code(201);
    return value;
  };
  const removed = async (reply: FastifyReply, work: Promise<unknown>) => {
    await work;
    reply.code(204);
  };
  return {
    createDomain(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createDomainBodySchema, request.body);
      return created(reply, service.createDomain(contextOf(request), body));
    },
    updateDomain(request: FastifyRequest) {
      const { key } = parseOrThrow(domainKeyParamsSchema, request.params);
      const body = parseOrThrow(updateDomainBodySchema, request.body);
      return service.updateDomain(contextOf(request), key, body);
    },
    removeDomain(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(domainKeyParamsSchema, request.params);
      return removed(reply, service.removeDomain(contextOf(request), key));
    },
    createGroup(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createGroupBodySchema, request.body);
      return created(reply, service.createGroup(contextOf(request), body));
    },
    updateGroup(request: FastifyRequest) {
      const { id } = parseOrThrow(groupParamsSchema, request.params);
      const body = parseOrThrow(updateGroupBodySchema, request.body);
      return service.updateGroup(contextOf(request), id, body);
    },
    removeGroup(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(groupParamsSchema, request.params);
      return removed(reply, service.removeGroup(contextOf(request), id));
    },
    createApplication(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createApplicationBodySchema, request.body);
      return created(reply, service.applications.create(contextOf(request), body));
    },
    updateApplication(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const body = parseOrThrow(updateApplicationBodySchema, request.body);
      return service.applications.update(contextOf(request), key, body);
    },
    setDependencies(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const { dependsOn } = parseOrThrow(dependenciesBodySchema, request.body);
      return service.applications.setDependencies(contextOf(request), key, dependsOn);
    },
    removeApplication(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return removed(reply, service.applications.remove(contextOf(request), key));
    },
    changes(request: FastifyRequest) {
      const query = parseOrThrow(listCatalogChangesQuerySchema, request.query);
      return service.changes(contextOf(request), query);
    },
  };
}

export type CatalogWritesController = ReturnType<typeof createCatalogWritesController>;
