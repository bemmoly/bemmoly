import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  addDashboardWidgetBodySchema,
  createDashboardBodySchema,
  dashboardWidgetParamsSchema,
  listDashboardsQuerySchema,
  updateDashboardBodySchema,
  type Dashboard,
} from '../../../shared/dashboards.ts';
import type { DashboardsService } from '../services/dashboards/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createDashboardsController(service: DashboardsService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async list(request: FastifyRequest): Promise<{ items: Dashboard[] }> {
      const query = parseOrThrow(listDashboardsQuerySchema, request.query);
      return { items: await service.list(contextOf(request), query) };
    },
    async get(request: FastifyRequest): Promise<Dashboard> {
      return service.get(contextOf(request), id(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Dashboard> {
      const body = parseOrThrow(createDashboardBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<Dashboard> {
      const body = parseOrThrow(updateDashboardBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), id(request));
      reply.code(204).send();
    },
    async addWidget(request: FastifyRequest, reply: FastifyReply): Promise<Dashboard> {
      const body = parseOrThrow(addDashboardWidgetBodySchema, request.body);
      reply.code(201);
      return service.addWidget(contextOf(request), id(request), body);
    },
    async removeWidget(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const params = parseOrThrow(dashboardWidgetParamsSchema, request.params);
      await service.removeWidget(contextOf(request), params.id, params.widgetId);
      reply.code(204).send();
    },
  };
}

export type DashboardsController = ReturnType<typeof createDashboardsController>;
