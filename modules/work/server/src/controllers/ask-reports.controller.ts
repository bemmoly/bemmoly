import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  askReportBodySchema,
  createPinnedReportBodySchema,
  runReportBodySchema,
  type AskReportResponse,
  type PinnedReport,
  type PinnedReportView,
  type ReportResult,
} from '../../../shared/ask-reports.ts';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import type { AskReportsServices } from '../services/ask-reports/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createAskReportsController(services: AskReportsServices) {
  const key = (request: FastifyRequest) => parseOrThrow(projectRefParamsSchema, request.params).key;

  return {
    async ask(request: FastifyRequest): Promise<AskReportResponse> {
      const body = parseOrThrow(askReportBodySchema, request.body);
      return services.ask.ask(contextOf(request), key(request), body);
    },
    async run(request: FastifyRequest): Promise<ReportResult> {
      const body = parseOrThrow(runReportBodySchema, request.body);
      return services.pinned.run(contextOf(request), key(request), body.spec);
    },
    async listPinned(request: FastifyRequest): Promise<{ items: PinnedReportView[] }> {
      return { items: await services.pinned.list(contextOf(request), key(request)) };
    },
    async pin(request: FastifyRequest, reply: FastifyReply): Promise<PinnedReport> {
      const body = parseOrThrow(createPinnedReportBodySchema, request.body);
      reply.code(201);
      return services.pinned.create(contextOf(request), key(request), body);
    },
    async unpin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParams, request.params);
      await services.pinned.remove(contextOf(request), id);
      reply.code(204).send();
    },
  };
}

export type AskReportsController = ReturnType<typeof createAskReportsController>;
