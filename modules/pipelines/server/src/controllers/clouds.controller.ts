import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  applyLandingZoneBodySchema,
  connectCloudBodySchema,
  connectionParamsSchema,
  landingZonePlanBodySchema,
} from '../../../shared/clouds.ts';
import type { CloudsService } from '../services/clouds/index.ts';

/** Platform › Clouds: providers, connections, the landing zone and what it made. */
export function createCloudsController(clouds: CloudsService) {
  const idOf = (request: FastifyRequest) => parseOrThrow(connectionParamsSchema, request.params).id;
  return {
    providers: (request: FastifyRequest) => clouds.providers(contextOf(request)),
    list: (request: FastifyRequest) => clouds.list(contextOf(request)),
    async connect(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(connectCloudBodySchema, request.body);
      const created = await clouds.connect(contextOf(request), body);
      reply.code(201);
      return created;
    },
    check: (request: FastifyRequest) => clouds.check(contextOf(request), idOf(request)),
    plan(request: FastifyRequest) {
      const body = parseOrThrow(landingZonePlanBodySchema, request.body ?? {});
      return clouds.plan(contextOf(request), idOf(request), body);
    },
    async apply(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(applyLandingZoneBodySchema, request.body);
      const plan = await clouds.apply(contextOf(request), idOf(request), body);
      // Accepted: the landing zone is applied by a job; accounts and resources show progress.
      reply.code(202);
      return plan;
    },
    accounts: (request: FastifyRequest) => clouds.accounts(contextOf(request), idOf(request)),
    resources: (request: FastifyRequest) => clouds.resources(contextOf(request), idOf(request)),
  };
}

export type CloudsController = ReturnType<typeof createCloudsController>;
