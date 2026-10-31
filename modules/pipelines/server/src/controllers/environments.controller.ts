import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createEnvironmentBodySchema,
  pathParamsSchema,
  setPathBodySchema,
  updateEnvironmentBodySchema,
} from '../../../shared/environment-writes.ts';
import { environmentKeyParamsSchema, listTeamsQuerySchema } from '../../../shared/environments.ts';
import { overviewQuerySchema } from '../../../shared/overview.ts';
import type { EnvironmentsService } from '../services/environments/index.ts';
import type { OverviewService } from '../services/overview/index.ts';
import type { TeamsService } from '../services/teams/index.ts';

/** Environments, their paths, teams and the overview numbers. */
export function createOrganisationController(services: {
  environments: EnvironmentsService;
  teams: TeamsService;
  overview: OverviewService;
}) {
  return {
    environments: (request: FastifyRequest) => services.environments.list(contextOf(request)),
    paths: (request: FastifyRequest) => services.environments.paths(contextOf(request)),
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createEnvironmentBodySchema, request.body);
      const created = await services.environments.create(contextOf(request), body);
      reply.code(201);
      return created;
    },
    update(request: FastifyRequest) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      const body = parseOrThrow(updateEnvironmentBodySchema, request.body);
      return services.environments.update(contextOf(request), key, body);
    },
    async archive(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      await services.environments.archive(contextOf(request), key);
      reply.code(204);
    },
    setPath(request: FastifyRequest) {
      const { tier } = parseOrThrow(pathParamsSchema, request.params);
      const body = parseOrThrow(setPathBodySchema, request.body);
      return services.environments.setPath(contextOf(request), tier, body);
    },
    teams(request: FastifyRequest) {
      const query = parseOrThrow(listTeamsQuerySchema, request.query);
      return services.teams.list(contextOf(request), query);
    },
    overview(request: FastifyRequest) {
      const query = parseOrThrow(overviewQuerySchema, request.query);
      return services.overview.get(contextOf(request), query);
    },
  };
}

export type OrganisationController = ReturnType<typeof createOrganisationController>;
