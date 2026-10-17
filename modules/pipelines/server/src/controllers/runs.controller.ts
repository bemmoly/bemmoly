import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  cancelRunBodySchema,
  createRunBodySchema,
  listRunsQuerySchema,
  rerunBodySchema,
  runParamsSchema,
} from '../../../shared/runs.ts';
import type { RunsService } from '../services/runs/index.ts';

/** Runs under /api/v1/pipelines/runs, and an application's pipeline for the run form. */
export function createRunsController(service: RunsService) {
  return {
    list(request: FastifyRequest) {
      return service.list(contextOf(request), parseOrThrow(listRunsQuerySchema, request.query));
    },
    get(request: FastifyRequest) {
      return service.get(contextOf(request), parseOrThrow(runParamsSchema, request.params).id);
    },
    graph(request: FastifyRequest) {
      return service.graph(contextOf(request), parseOrThrow(runParamsSchema, request.params).id);
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createRunBodySchema, request.body ?? {});
      const run = await service.create(contextOf(request), body);
      reply.code(201);
      return run;
    },
    cancel(request: FastifyRequest) {
      const { id } = parseOrThrow(runParamsSchema, request.params);
      return service.cancel(
        contextOf(request),
        id,
        parseOrThrow(cancelRunBodySchema, request.body ?? {}),
      );
    },
    rerun(request: FastifyRequest) {
      const { id } = parseOrThrow(runParamsSchema, request.params);
      return service.rerun(
        contextOf(request),
        id,
        parseOrThrow(rerunBodySchema, request.body ?? {}),
      );
    },
    pipeline(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return service.pipeline(contextOf(request), key);
    },
  };
}

export type RunsController = ReturnType<typeof createRunsController>;
