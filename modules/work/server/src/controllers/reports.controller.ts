import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import {
  cycleReportQuerySchema,
  scopeReportQuerySchema,
  type ControlChart,
  type ScopeReport,
  type TimeInStatus,
} from '../../../shared/reports.ts';
import type { ReportsService } from '../services/reports/index.ts';

export function createReportsController(service: ReportsService) {
  const key = (request: FastifyRequest) => parseOrThrow(projectRefParamsSchema, request.params).key;

  return {
    async control(request: FastifyRequest): Promise<ControlChart> {
      const query = parseOrThrow(cycleReportQuerySchema, request.query);
      return service.control(contextOf(request), key(request), query);
    },
    async timeInStatus(request: FastifyRequest): Promise<TimeInStatus> {
      const query = parseOrThrow(cycleReportQuerySchema, request.query);
      return service.timeInStatus(contextOf(request), key(request), query);
    },
    async scope(request: FastifyRequest): Promise<ScopeReport> {
      const query = parseOrThrow(scopeReportQuerySchema, request.query);
      return service.scope(contextOf(request), key(request), query);
    },
  };
}

export type ReportsController = ReturnType<typeof createReportsController>;
