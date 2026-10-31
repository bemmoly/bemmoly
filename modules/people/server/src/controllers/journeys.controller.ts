import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { idParamsSchema } from '../../../shared/common.ts';
import {
  createJourneyTemplateBodySchema,
  listJourneysQuerySchema,
  startJourneyBodySchema,
  updateJourneyTaskBodySchema,
  updateJourneyTemplateBodySchema,
} from '../../../shared/journeys.ts';
import type { JourneysService } from '../services/journeys/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

export function createJourneysController(service: JourneysService) {
  return {
    async listTemplates() {
      return { items: await service.templates.list() };
    },
    async createTemplate(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createJourneyTemplateBodySchema, request.body);
      reply.code(201);
      return service.templates.create(contextOf(request), body);
    },
    async updateTemplate(request: FastifyRequest) {
      const body = parseOrThrow(updateJourneyTemplateBodySchema, request.body);
      return service.templates.update(contextOf(request), idOf(request), body);
    },
    async list(request: FastifyRequest) {
      const query = parseOrThrow(listJourneysQuerySchema, request.query);
      return { items: await service.list(contextOf(request), query) };
    },
    async get(request: FastifyRequest) {
      return service.get(contextOf(request), idOf(request));
    },
    async start(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(startJourneyBodySchema, request.body);
      reply.code(201);
      return service.start(contextOf(request), body);
    },
    async updateTask(request: FastifyRequest) {
      const body = parseOrThrow(updateJourneyTaskBodySchema, request.body);
      return service.updateTask(contextOf(request), idOf(request), body);
    },
    async myTasks(request: FastifyRequest) {
      return { items: await service.myTasks(contextOf(request)) };
    },
  };
}

export type JourneysController = ReturnType<typeof createJourneysController>;
