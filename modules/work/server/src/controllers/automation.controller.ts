import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createAutomationRuleBodySchema,
  createAutomationRunBodySchema,
  listAutomationRulesQuerySchema,
  listAutomationRunsQuerySchema,
  updateAutomationRuleBodySchema,
  type AutomationCatalog,
  type AutomationRule,
  type AutomationRun,
  type AutomationRunsPage,
} from '../../../shared/index.ts';
import type { AutomationService } from '../services/automation/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createAutomationController(service: AutomationService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async catalog(request: FastifyRequest): Promise<AutomationCatalog> {
      return service.catalog(contextOf(request));
    },
    async list(request: FastifyRequest): Promise<{ items: AutomationRule[] }> {
      const query = parseOrThrow(listAutomationRulesQuerySchema, request.query);
      return { items: await service.list(contextOf(request), query) };
    },
    async get(request: FastifyRequest): Promise<AutomationRule> {
      return service.get(contextOf(request), id(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<AutomationRule> {
      const body = parseOrThrow(createAutomationRuleBodySchema, request.body);
      const rule = await service.create(contextOf(request), body);
      reply.code(201);
      return rule;
    },
    async update(request: FastifyRequest): Promise<AutomationRule> {
      const body = parseOrThrow(updateAutomationRuleBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), id(request));
      reply.code(204).send();
    },
    async test(request: FastifyRequest, reply: FastifyReply): Promise<AutomationRun> {
      const body = parseOrThrow(createAutomationRunBodySchema, request.body);
      const run = await service.test(contextOf(request), id(request), body);
      reply.code(201);
      return run;
    },
    async runs(request: FastifyRequest): Promise<AutomationRunsPage> {
      const query = parseOrThrow(listAutomationRunsQuerySchema, request.query);
      return service.runs(contextOf(request), query);
    },
  };
}

export type AutomationController = ReturnType<typeof createAutomationController>;
