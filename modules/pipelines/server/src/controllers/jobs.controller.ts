import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  jobParamsSchema,
  logRangeQuerySchema,
  logSearchQuerySchema,
} from '../../../shared/logs.ts';
import { artifactUploadQuerySchema } from '../../../shared/runner.ts';
import {
  listFailuresQuerySchema,
  listTestsQuerySchema,
  quarantineBodySchema,
  quarantineParamsSchema,
} from '../../../shared/tests.ts';
import type { ArtifactsService } from '../services/artifacts/index.ts';
import type { LogsService } from '../services/logs/index.ts';
import type { TestsService } from '../services/tests/index.ts';

const artifactParamsSchema = jobParamsSchema.extend({ name: artifactUploadQuerySchema.shape.name });

/** Job logs and artifacts, tests and failure groups under /api/v1/pipelines. */
export function createJobsController(
  logs: LogsService,
  tests: TestsService,
  artifacts: ArtifactsService,
) {
  return {
    logs(request: FastifyRequest) {
      const { id } = parseOrThrow(jobParamsSchema, request.params);
      return logs.range(contextOf(request), id, parseOrThrow(logRangeQuerySchema, request.query));
    },
    search(request: FastifyRequest) {
      const { id } = parseOrThrow(jobParamsSchema, request.params);
      return logs.search(contextOf(request), id, parseOrThrow(logSearchQuerySchema, request.query));
    },
    artifacts(request: FastifyRequest) {
      const { id } = parseOrThrow(jobParamsSchema, request.params);
      return artifacts.list(contextOf(request), id);
    },
    async download(request: FastifyRequest, reply: FastifyReply) {
      const { id, name } = parseOrThrow(artifactParamsSchema, request.params);
      const file = await artifacts.read(contextOf(request), id, name);
      reply.header('content-type', file.contentType);
      reply.header('content-disposition', `attachment; filename="${name}"`);
      return reply.send(file.body);
    },
    tests(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return tests.list(contextOf(request), key, parseOrThrow(listTestsQuerySchema, request.query));
    },
    async quarantine(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const body = parseOrThrow(quarantineBodySchema, request.body ?? {});
      const status = await tests.quarantine(contextOf(request), key, body);
      reply.code(201);
      return status;
    },
    async release(request: FastifyRequest, reply: FastifyReply) {
      const { key, id } = parseOrThrow(quarantineParamsSchema, request.params);
      await tests.release(contextOf(request), key, id);
      return reply.code(204).send();
    },
    failures(request: FastifyRequest) {
      return tests.failures(
        contextOf(request),
        parseOrThrow(listFailuresQuerySchema, request.query),
      );
    },
  };
}

export type JobsController = ReturnType<typeof createJobsController>;
