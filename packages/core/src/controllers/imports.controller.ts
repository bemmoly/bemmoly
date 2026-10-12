import {
  createImportBodySchema,
  importContainerQuerySchema,
  importCountBodySchema,
  importPeopleQuerySchema,
  importTargetQuerySchema,
  type ImportPlannedJob,
  type ImportTargetList,
  type ImportPeoplePage,
  importSelectionBodySchema,
  type ImportContainerPage,
  type ImportCountList,
  type ImportSelectionSummary,
  importJobIdParamsSchema,
  parseOrThrow,
  updateImportBodySchema,
  type ImportJob,
  type ImportSource,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { ImportService } from '../services/import/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(importJobIdParamsSchema, request.params).id;

export function createImportsController(service: ImportService, actorOf: ActorResolver) {
  return {
    async sources(request: FastifyRequest): Promise<{ items: ImportSource[] }> {
      return { items: await service.sources(await actorOf(request)) };
    },
    async list(request: FastifyRequest): Promise<{ items: ImportJob[] }> {
      return { items: await service.list(await actorOf(request)) };
    },
    async get(request: FastifyRequest): Promise<ImportJob> {
      return service.get(await actorOf(request), idOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<ImportJob> {
      const body = parseOrThrow(createImportBodySchema, request.body);
      const job = await service.create(await actorOf(request), body);
      reply.code(201);
      return job;
    },
    async update(request: FastifyRequest): Promise<ImportPlannedJob> {
      const body = parseOrThrow(updateImportBodySchema, request.body);
      return service.update(await actorOf(request), idOf(request), body);
    },
    async run(request: FastifyRequest): Promise<ImportJob> {
      return service.run(await actorOf(request), idOf(request));
    },
    async containers(request: FastifyRequest): Promise<ImportContainerPage> {
      const query = parseOrThrow(importContainerQuerySchema, request.query);
      return service.containers(await actorOf(request), idOf(request), query);
    },
    async count(request: FastifyRequest): Promise<ImportCountList> {
      const body = parseOrThrow(importCountBodySchema, request.body);
      return service.count(await actorOf(request), idOf(request), body);
    },
    async targets(request: FastifyRequest): Promise<ImportTargetList> {
      const query = parseOrThrow(importTargetQuerySchema, request.query);
      return service.targets(await actorOf(request), idOf(request), query);
    },
    async people(request: FastifyRequest): Promise<ImportPeoplePage> {
      const query = parseOrThrow(importPeopleQuerySchema, request.query);
      return service.people(await actorOf(request), idOf(request), query);
    },
    async selection(request: FastifyRequest): Promise<ImportSelectionSummary> {
      return service.selection(await actorOf(request), idOf(request));
    },
    async select(request: FastifyRequest): Promise<ImportSelectionSummary> {
      const body = parseOrThrow(importSelectionBodySchema, request.body);
      return service.select(await actorOf(request), idOf(request), body);
    },
    async cancel(request: FastifyRequest): Promise<ImportJob> {
      return service.cancel(await actorOf(request), idOf(request));
    },
  };
}

export type ImportsController = ReturnType<typeof createImportsController>;
