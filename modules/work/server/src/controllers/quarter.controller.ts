import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import { quarterReportQuerySchema, type QuarterReport } from '../../../shared/quarter.ts';
import type { QuarterService } from '../services/reports/quarter-service.ts';

export function createQuarterController(service: QuarterService) {
  return {
    async quarter(request: FastifyRequest): Promise<QuarterReport> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(quarterReportQuerySchema, request.query);
      return service.quarter(contextOf(request), key, query);
    },
  };
}

export type QuarterController = ReturnType<typeof createQuarterController>;
