import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { insightsQuerySchema } from '../../../shared/insights.ts';
import type { InsightsService } from '../services/insights/index.ts';

/** Insights for a scope and a range. */
export function createInsightsController(service: InsightsService) {
  return {
    get(request: FastifyRequest) {
      return service.get(contextOf(request), parseOrThrow(insightsQuerySchema, request.query));
    },
  };
}

export type InsightsController = ReturnType<typeof createInsightsController>;
