import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { issueQueryParamsSchema } from '../../../shared/filters.ts';
import type { IssueSummariesPage, IssuesPage } from '../../../shared/issues.ts';
import type { LqlService } from '../services/lql/index.ts';

export function createLqlController(service: LqlService) {
  return {
    async query(request: FastifyRequest): Promise<IssuesPage> {
      const params = parseOrThrow(issueQueryParamsSchema, request.query);
      return service.query(contextOf(request), params);
    },
    async summaries(request: FastifyRequest): Promise<IssueSummariesPage> {
      const params = parseOrThrow(issueQueryParamsSchema, request.query);
      return service.summaries(contextOf(request), params);
    },
  };
}

export type LqlController = ReturnType<typeof createLqlController>;
