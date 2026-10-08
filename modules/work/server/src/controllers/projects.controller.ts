import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { listProjectsQuerySchema, type ProjectsPage } from '../../../shared/projects.ts';
import type { ProjectsService } from '../services/projects.ts';

export function createProjectsController(service: ProjectsService) {
  return {
    async list(request: FastifyRequest): Promise<ProjectsPage> {
      const query = parseOrThrow(listProjectsQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
  };
}

export type ProjectsController = ReturnType<typeof createProjectsController>;
