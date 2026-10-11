import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { myIssuesQuerySchema, type MyIssues } from '../../../shared/my-work.ts';
import type { MyWorkService } from '../services/my-work/index.ts';

export function createMyWorkController(service: MyWorkService) {
  return {
    async list(request: FastifyRequest): Promise<MyIssues> {
      const query = parseOrThrow(myIssuesQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
  };
}

export type MyWorkController = ReturnType<typeof createMyWorkController>;
