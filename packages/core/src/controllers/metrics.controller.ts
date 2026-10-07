import type { FastifyReply, FastifyRequest } from 'fastify';
import { scrapeMetrics, type ScrapeDependencies } from '../services/telemetry/index.ts';

export function createMetricsController(deps: ScrapeDependencies) {
  return {
    async scrape(request: FastifyRequest, reply: FastifyReply): Promise<string> {
      const result = await scrapeMetrics(deps, request.headers.authorization);
      reply.header('content-type', result.contentType);
      reply.header('cache-control', 'no-store');
      return result.body;
    },
  };
}

export type MetricsController = ReturnType<typeof createMetricsController>;
