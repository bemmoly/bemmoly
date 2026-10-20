import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { backlogQuerySchema, moveIssueBodySchema, type Backlog } from '../../../shared/backlog.ts';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import { issueKeyParamsSchema } from '../../../shared/common.ts';
import type { Issue } from '../../../shared/issues.ts';
import type { BacklogService } from '../services/backlog/index.ts';

export function createBacklogController(service: BacklogService) {
  return {
    async get(request: FastifyRequest): Promise<Backlog> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(backlogQuerySchema, request.query);
      return service.get(contextOf(request), key, query);
    },
    async move(request: FastifyRequest): Promise<Issue> {
      const { key } = parseOrThrow(issueKeyParamsSchema, request.params);
      const body = parseOrThrow(moveIssueBodySchema, request.body);
      return service.move(contextOf(request), key, body);
    },
  };
}

export type BacklogController = ReturnType<typeof createBacklogController>;
