import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { changesQuerySchema } from '../../../shared/changes.ts';
import { currentQuerySchema } from '../../../shared/deployments.ts';
import type { HistoryService } from '../services/history/index.ts';

/** What runs where (now or rewound) and What changed?. */
export function createHistoryController(service: HistoryService) {
  return {
    current: (request: FastifyRequest) =>
      service.current(contextOf(request), parseOrThrow(currentQuerySchema, request.query)),
    changes: (request: FastifyRequest) =>
      service.changes(contextOf(request), parseOrThrow(changesQuerySchema, request.query)),
  };
}

export type HistoryController = ReturnType<typeof createHistoryController>;
