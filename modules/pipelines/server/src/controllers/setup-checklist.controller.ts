import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { startOverBodySchema } from '../../../shared/pipeline-setup.ts';
import type { SetupChecklistService } from '../services/setup-checklist/index.ts';

/** The setup checklist and Start over. */
export function createSetupChecklistController(service: SetupChecklistService) {
  return {
    checklist: (request: FastifyRequest) => service.checklist(contextOf(request)),
    startOver(request: FastifyRequest) {
      const body = parseOrThrow(startOverBodySchema, request.body);
      return service.startOver(contextOf(request), body);
    },
  };
}

export type SetupChecklistController = ReturnType<typeof createSetupChecklistController>;
