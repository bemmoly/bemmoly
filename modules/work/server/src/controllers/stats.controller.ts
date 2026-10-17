import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import { reportStatsQuerySchema, type ReportStats } from '../../../shared/report-stats.ts';
import type { StatsService } from '../services/reports/stats-service.ts';

export function createStatsController(service: StatsService) {
  return {
    async stats(request: FastifyRequest): Promise<ReportStats> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(reportStatsQuerySchema, request.query);
      return service.stats(contextOf(request), key, query);
    },
  };
}

export type StatsController = ReturnType<typeof createStatsController>;
