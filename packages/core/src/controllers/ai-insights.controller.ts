import { parseOrThrow } from '@bemmoly/shared';
import {
  aiInsightFeedbackBodySchema,
  aiInsightFeedbackParamsSchema,
  aiInsightParamsSchema,
  type AiInsightResponse,
} from '@bemmoly/shared/ai-insights';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { InsightsService } from '../services/ai/index.ts';
import { contextOf } from './request-context.ts';

export function createAiInsightsController(service: InsightsService) {
  return {
    async get(request: FastifyRequest): Promise<AiInsightResponse> {
      const { kind, targetId } = parseOrThrow(aiInsightParamsSchema, request.params);
      return { insight: await service.get(contextOf(request), kind, targetId) };
    },

    async refresh(request: FastifyRequest, reply: FastifyReply): Promise<AiInsightResponse> {
      const { kind, targetId } = parseOrThrow(aiInsightParamsSchema, request.params);
      const insight = await service.refresh(contextOf(request), kind, targetId);
      reply.code(202);
      return { insight };
    },

    async feedback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(aiInsightFeedbackParamsSchema, request.params);
      const { feedback } = parseOrThrow(aiInsightFeedbackBodySchema, request.body);
      await service.feedback(contextOf(request), id, feedback);
      reply.code(204);
    },
  };
}

export type AiInsightsController = ReturnType<typeof createAiInsightsController>;
