import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import {
  compareQuerySchema,
  listReleasesQuerySchema,
  releaseParamsSchema,
} from '../../../shared/releases.ts';
import type { ReleasesService } from '../services/releases/index.ts';

/** Release reads: the list, one release, and what differs between two. */
export function createReleasesController(service: ReleasesService) {
  return {
    list: (request: FastifyRequest) =>
      service.list(contextOf(request), parseOrThrow(listReleasesQuerySchema, request.query)),
    get: (request: FastifyRequest) =>
      service.get(contextOf(request), parseOrThrow(releaseParamsSchema, request.params).id),
    compare: (request: FastifyRequest) =>
      service.compare(contextOf(request), parseOrThrow(compareQuerySchema, request.query)),
  };
}

export type ReleasesController = ReturnType<typeof createReleasesController>;
