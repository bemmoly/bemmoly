import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createProjectBodySchema,
  listProjectsQuerySchema,
  projectKeyParamsSchema,
  updateProjectBodySchema,
  type Project,
  type ProjectsPage,
} from '../../../shared/projects.ts';
import type { ProjectsService } from '../services/projects/index.ts';

export const keyOf = (request: FastifyRequest) =>
  parseOrThrow(projectKeyParamsSchema, request.params).key;

export function createProjectsController(service: ProjectsService) {
  return {
    async list(request: FastifyRequest): Promise<ProjectsPage> {
      const query = parseOrThrow(listProjectsQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
    async get(request: FastifyRequest): Promise<Project> {
      return service.get(contextOf(request), keyOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Project> {
      const body = parseOrThrow(createProjectBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<Project> {
      const body = parseOrThrow(updateProjectBodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), body);
    },
    async archive(request: FastifyRequest): Promise<Project> {
      return service.archive(contextOf(request), keyOf(request));
    },
    async unarchive(request: FastifyRequest): Promise<Project> {
      return service.unarchive(contextOf(request), keyOf(request));
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), keyOf(request));
      reply.code(204);
    },
  };
}

export type ProjectsController = ReturnType<typeof createProjectsController>;
