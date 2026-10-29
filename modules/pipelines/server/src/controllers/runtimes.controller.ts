import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import { clusterBodySchema, clusterParamsSchema } from '../../../shared/clusters.ts';
import {
  applicationRuntimeParamsSchema,
  setApplicationRuntimeBodySchema,
} from '../../../shared/runtimes.ts';
import type { ClustersService } from '../services/clusters/index.ts';
import type { RuntimesService } from '../services/runtimes/index.ts';

/** Where applications run: clusters per environment and each application's runtime. */
export function createRuntimesController(clusters: ClustersService, runtimes: RuntimesService) {
  const idOf = (request: FastifyRequest) => parseOrThrow(clusterParamsSchema, request.params).id;
  return {
    clusters: (request: FastifyRequest) => clusters.list(contextOf(request)),
    async addCluster(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(clusterBodySchema, request.body);
      const cluster = await clusters.add(contextOf(request), body);
      reply.code(201);
      return cluster;
    },
    checkCluster: (request: FastifyRequest) => clusters.check(contextOf(request), idOf(request)),
    async removeCluster(request: FastifyRequest, reply: FastifyReply) {
      await clusters.remove(contextOf(request), idOf(request));
      reply.code(204);
    },
    runtimes(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return runtimes.list(contextOf(request), key);
    },
    setRuntime(request: FastifyRequest) {
      const params = parseOrThrow(applicationRuntimeParamsSchema, request.params);
      const body = parseOrThrow(setApplicationRuntimeBodySchema, request.body);
      return runtimes.set(contextOf(request), params.key, params.environment, body);
    },
  };
}

export type RuntimesController = ReturnType<typeof createRuntimesController>;
