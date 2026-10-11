import {
  aiPlanCreateBodySchema,
  aiPlanIdParamsSchema,
  aiPlanRunBodySchema,
  parseOrThrow,
  type AiPlan,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AiPlansService } from '../services/ai/index.ts';
import { contextOf } from './request-context.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(aiPlanIdParamsSchema, request.params).id;

export function createAiPlansController(service: AiPlansService) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<AiPlan> {
      const body = parseOrThrow(aiPlanCreateBodySchema, request.body);
      const plan = await service.create(contextOf(request), body);
      reply.code(201);
      return plan;
    },
    async get(request: FastifyRequest): Promise<AiPlan> {
      return service.get(contextOf(request), idOf(request));
    },
    async run(request: FastifyRequest): Promise<AiPlan> {
      const body = parseOrThrow(aiPlanRunBodySchema, request.body ?? {});
      return service.run(contextOf(request), idOf(request), body);
    },
    async cancel(request: FastifyRequest): Promise<AiPlan> {
      return service.cancel(contextOf(request), idOf(request));
    },
    async undo(request: FastifyRequest): Promise<AiPlan> {
      return service.undo(contextOf(request), idOf(request));
    },
  };
}

export type AiPlansController = ReturnType<typeof createAiPlansController>;
