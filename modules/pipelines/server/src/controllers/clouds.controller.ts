import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { connectCloudBodySchema, connectionParamsSchema } from '../../../shared/clouds.ts';
import {
  applyLandingZoneBodySchema,
  landingZonePlanBodySchema,
  planParamsSchema,
} from '../../../shared/landing-zones.ts';
import {
  accountParamsSchema,
  attachAccountBodySchema,
  updateConnectionBodySchema,
} from '../../../shared/cloud-accounts.ts';
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
    update(request: FastifyRequest) {
      const body = parseOrThrow(updateConnectionBodySchema, request.body);
      return clouds.update(contextOf(request), idOf(request), body);
    },
    async attach(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(attachAccountBodySchema, request.body);
      const attached = await clouds.attach(contextOf(request), idOf(request), body);
      reply.code(201);
      return attached;
    },
    recheck(request: FastifyRequest) {
      const params = parseOrThrow(accountParamsSchema, request.params);
      return clouds.recheck(contextOf(request), params.id, params.accountId);
    },
    async detach(request: FastifyRequest, reply: FastifyReply) {
      const params = parseOrThrow(accountParamsSchema, request.params);
      await clouds.detach(contextOf(request), params.id, params.accountId);
      reply.code(204);
    },
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
    /** One plan with how its apply is going, for the progress screen and Retry. */
    planById(request: FastifyRequest) {
      const params = parseOrThrow(planParamsSchema, request.params);
      return clouds.planById(contextOf(request), params.id, params.planId);
    },
    accounts: (request: FastifyRequest) => clouds.accounts(contextOf(request), idOf(request)),
    resources: (request: FastifyRequest) => clouds.resources(contextOf(request), idOf(request)),
  };
}

export type CloudsController = ReturnType<typeof createCloudsController>;
