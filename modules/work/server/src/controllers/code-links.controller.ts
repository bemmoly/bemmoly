import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import {
  updateCodeTransitionsBodySchema,
  type CodeLinksResponse,
  type CodeTransitions,
} from '../../../shared/code-links.ts';
import { issueKeyParamsSchema } from '../../../shared/common.ts';
import { projectKeyParamsSchema } from '../../../shared/projects.ts';
import type { CodeLinksService } from '../services/code-links/index.ts';

/** An issue's Development section and a project's moves on pull request changes. */
export function createCodeLinksController(service: CodeLinksService) {
  return {
    async list(request: FastifyRequest): Promise<CodeLinksResponse> {
      const { key } = parseOrThrow(issueKeyParamsSchema, request.params);
      return { items: await service.list(contextOf(request), key) };
    },
    async transitions(request: FastifyRequest): Promise<CodeTransitions> {
      const { key } = parseOrThrow(projectKeyParamsSchema, request.params);
      return service.transitions(contextOf(request), key);
    },
    async updateTransitions(request: FastifyRequest): Promise<CodeTransitions> {
      const { key } = parseOrThrow(projectKeyParamsSchema, request.params);
      const body = parseOrThrow(updateCodeTransitionsBodySchema, request.body);
      return service.updateTransitions(contextOf(request), key, body);
    },
  };
}

export type CodeLinksController = ReturnType<typeof createCodeLinksController>;
