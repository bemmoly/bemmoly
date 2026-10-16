import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { boardMetricsQuerySchema, type BoardMetrics } from '../../../shared/metrics.ts';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import { flowReportQuerySchema, type FlowReport } from '../../../shared/reports.ts';
import type { SprintReport } from '../../../shared/sprints.ts';
import type { MetricsService } from '../services/metrics/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createMetricsController(service: MetricsService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async board(request: FastifyRequest): Promise<BoardMetrics> {
      const query = parseOrThrow(boardMetricsQuerySchema, request.query);
      return service.board(contextOf(request), id(request), query);
    },
    async sprintReport(request: FastifyRequest): Promise<SprintReport> {
      return service.sprintReport(contextOf(request), id(request));
    },
    async flowReport(request: FastifyRequest): Promise<FlowReport> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(flowReportQuerySchema, request.query);
      return service.flowReport(contextOf(request), key, query);
    },
  };
}

export type MetricsController = ReturnType<typeof createMetricsController>;
