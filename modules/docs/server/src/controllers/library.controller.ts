import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  recentPagesQuerySchema,
  starredPagesQuerySchema,
  type HomePages,
} from '../../../shared/home.ts';
import { attentionQuerySchema, type AttentionResponse } from '../../../shared/attention.ts';
import type { PageDetail } from '../../../shared/pages.ts';
import {
  labelSuggestQuerySchema,
  setLabelsBodySchema,
  type LabelUsage,
  type LabelsResponse,
  type StarResponse,
} from '../../../shared/stars-labels.ts';
import {
  createFromTemplateBodySchema,
  createTemplateBodySchema,
  listTemplatesQuerySchema,
  templateIdParamsSchema,
  updateTemplateBodySchema,
  type TemplateDetail,
  type TemplateSummary,
} from '../../../shared/templates.ts';
import type { HomeService } from '../services/home/index.ts';
import type { StarsLabelsService } from '../services/stars-labels/index.ts';
import type { TemplatesService } from '../services/templates/index.ts';
import { pageIdOf } from './pages.controller.ts';

const templateIdOf = (request: FastifyRequest) =>
  parseOrThrow(templateIdParamsSchema, request.params).templateId;

interface LibraryServices {
  home: HomeService;
  starsLabels: StarsLabelsService;
  templates: TemplatesService;
}

/** What surrounds the pages: the Docs home lists, stars, labels and templates. */
export function createLibraryController(services: LibraryServices) {
  return {
    async recent(request: FastifyRequest): Promise<HomePages> {
      const query = parseOrThrow(recentPagesQuerySchema, request.query);
      return services.home.recent(contextOf(request), query);
    },
    async starred(request: FastifyRequest): Promise<HomePages> {
      const query = parseOrThrow(starredPagesQuerySchema, request.query);
      return services.home.starred(contextOf(request), query);
    },
    async attention(request: FastifyRequest): Promise<AttentionResponse> {
      const query = parseOrThrow(attentionQuerySchema, request.query);
      return services.home.attention(contextOf(request), query);
    },
    async star(request: FastifyRequest): Promise<StarResponse> {
      return services.starsLabels.star(contextOf(request), pageIdOf(request), true);
    },
    async unstar(request: FastifyRequest): Promise<StarResponse> {
      return services.starsLabels.star(contextOf(request), pageIdOf(request), false);
    },
    async setLabels(request: FastifyRequest): Promise<LabelsResponse> {
      const body = parseOrThrow(setLabelsBodySchema, request.body);
      return services.starsLabels.setLabels(contextOf(request), pageIdOf(request), body);
    },
    async suggestLabels(request: FastifyRequest): Promise<{ items: LabelUsage[] }> {
      const query = parseOrThrow(labelSuggestQuerySchema, request.query);
      return { items: await services.starsLabels.suggestLabels(contextOf(request), query) };
    },
    async listTemplates(request: FastifyRequest): Promise<{ items: TemplateSummary[] }> {
      const query = parseOrThrow(listTemplatesQuerySchema, request.query);
      return { items: await services.templates.list(contextOf(request), query) };
    },
    async getTemplate(request: FastifyRequest): Promise<TemplateDetail> {
      return services.templates.get(contextOf(request), templateIdOf(request));
    },
    async createTemplate(request: FastifyRequest, reply: FastifyReply): Promise<TemplateDetail> {
      const body = parseOrThrow(createTemplateBodySchema, request.body);
      reply.code(201);
      return services.templates.create(contextOf(request), body);
    },
    async updateTemplate(request: FastifyRequest): Promise<TemplateDetail> {
      const body = parseOrThrow(updateTemplateBodySchema, request.body);
      return services.templates.update(contextOf(request), templateIdOf(request), body);
    },
    async removeTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await services.templates.remove(contextOf(request), templateIdOf(request));
      reply.code(204);
    },
    async createFromTemplate(request: FastifyRequest, reply: FastifyReply): Promise<PageDetail> {
      const body = parseOrThrow(createFromTemplateBodySchema, request.body);
      reply.code(201);
      return services.templates.createPage(contextOf(request), templateIdOf(request), body);
    },
  };
}

export type LibraryController = ReturnType<typeof createLibraryController>;
