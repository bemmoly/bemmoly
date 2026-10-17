import { abortOnClose } from '@bemmoly/core';
import { parseOrThrow, ValidationError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  artifactUploadQuerySchema,
  claimBodySchema,
  finishJobBodySchema,
  heartbeatBodySchema,
  JOB_TOKEN_HEADER,
  jobStateBodySchema,
  logChunkUploadSchema,
  registerRunnerBodySchema,
  RUNNER_PROTOCOL_HEADER,
  RUNNER_PROTOCOL_VERSION,
  RUNNER_TOKEN_HEADER,
  runnerJobParamsSchema,
  runnerStepParamsSchema,
  splitsBodySchema,
  stepStateBodySchema,
  testReportUploadSchema,
} from '../../../shared/runner.ts';
import type { RunnerService } from '../services/runner/index.ts';

/*
 * The runner protocol under /api/v1/runner. Anonymous to the kernel by design: runners have
 * no person behind them and authenticate with their own tokens, which the service checks.
 */

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

/** Answers an unsupported protocol version before anything else runs. */
export function checkProtocol(request: FastifyRequest): void {
  const version = header(request, RUNNER_PROTOCOL_HEADER);
  if (version !== RUNNER_PROTOCOL_VERSION) {
    throw new ValidationError(
      `This server speaks runner protocol ${RUNNER_PROTOCOL_VERSION}; update bemmoly-runner`,
    );
  }
}

export function createRunnerController(service: RunnerService) {
  const jobToken = (request: FastifyRequest) => header(request, JOB_TOKEN_HEADER);
  const runnerToken = (request: FastifyRequest) => header(request, RUNNER_TOKEN_HEADER);
  const jobId = (request: FastifyRequest) => parseOrThrow(runnerJobParamsSchema, request.params).id;
  return {
    async register(request: FastifyRequest, reply: FastifyReply) {
      const registered = await service.register(
        parseOrThrow(registerRunnerBodySchema, request.body ?? {}),
      );
      reply.code(201);
      return registered;
    },
    heartbeat(request: FastifyRequest) {
      return service.heartbeat(
        runnerToken(request),
        parseOrThrow(heartbeatBodySchema, request.body ?? {}),
      );
    },
    async claim(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(claimBodySchema, request.body ?? {});
      // The response, not the request: Node closes a request once its body is read, which would
      // end every long poll at once and send the runner straight back for another claim.
      const job = await service.claim(runnerToken(request), body, abortOnClose(reply));
      if (!job) return reply.code(204).send();
      return { job };
    },
    async jobState(request: FastifyRequest, reply: FastifyReply) {
      await service.jobState(
        jobId(request),
        jobToken(request),
        parseOrThrow(jobStateBodySchema, request.body ?? {}),
      );
      return reply.code(204).send();
    },
    async stepState(request: FastifyRequest, reply: FastifyReply) {
      const { id, position } = parseOrThrow(runnerStepParamsSchema, request.params);
      await service.stepState(
        id,
        position,
        jobToken(request),
        parseOrThrow(stepStateBodySchema, request.body ?? {}),
      );
      return reply.code(204).send();
    },
    async logs(request: FastifyRequest, reply: FastifyReply) {
      await service.logs(
        jobId(request),
        jobToken(request),
        parseOrThrow(logChunkUploadSchema, request.body ?? {}),
      );
      return reply.code(204).send();
    },
    async tests(request: FastifyRequest, reply: FastifyReply) {
      await service.tests(
        jobId(request),
        jobToken(request),
        parseOrThrow(testReportUploadSchema, request.body ?? {}),
      );
      return reply.code(204).send();
    },
    splits(request: FastifyRequest) {
      return service.splits(
        jobId(request),
        jobToken(request),
        parseOrThrow(splitsBodySchema, request.body ?? {}),
      );
    },
    secrets(request: FastifyRequest) {
      return service.secrets(jobId(request), jobToken(request));
    },
    async artifact(request: FastifyRequest, reply: FastifyReply) {
      const { name } = parseOrThrow(artifactUploadQuerySchema, request.query);
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const artifact = await service.artifact(
        jobId(request),
        jobToken(request),
        name,
        body,
        'application/octet-stream',
      );
      reply.code(201);
      return artifact;
    },
    async finish(request: FastifyRequest, reply: FastifyReply) {
      await service.finish(
        jobId(request),
        jobToken(request),
        parseOrThrow(finishJobBodySchema, request.body ?? {}),
      );
      return reply.code(204).send();
    },
  };
}

export type RunnerController = ReturnType<typeof createRunnerController>;
