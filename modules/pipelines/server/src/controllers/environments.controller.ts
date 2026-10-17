import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { listTeamsQuerySchema } from '../../../shared/environments.ts';
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
