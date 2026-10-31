import type { StartSummariesResponse } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { StartService } from '../services/start/index.ts';
import { contextOf } from './request-context.ts';

export function createStartController(service: StartService) {
  return {
    async summaries(request: FastifyRequest): Promise<StartSummariesResponse> {
      return { items: await service.summaries(contextOf(request)) };
    },
  };
}

export type StartController = ReturnType<typeof createStartController>;
