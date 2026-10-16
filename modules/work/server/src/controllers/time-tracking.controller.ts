import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import {
  timeTrackingQuerySchema,
  type TimeTrackingReport,
} from '../../../shared/report-time-tracking.ts';
import type { TimeTrackingService } from '../services/reports/time-tracking-service.ts';

export function createTimeTrackingController(service: TimeTrackingService) {
  return {
    async report(request: FastifyRequest): Promise<TimeTrackingReport> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(timeTrackingQuerySchema, request.query);
      return service.report(contextOf(request), key, query);
    },
  };
}

export type TimeTrackingController = ReturnType<typeof createTimeTrackingController>;
