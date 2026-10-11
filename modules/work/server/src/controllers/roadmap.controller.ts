import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { roadmapQuerySchema, type RoadmapView } from '../../../shared/roadmap.ts';
import type { RoadmapService } from '../services/roadmap/index.ts';

export function createRoadmapController(service: RoadmapService) {
  return {
    async view(request: FastifyRequest): Promise<RoadmapView> {
      const query = parseOrThrow(roadmapQuerySchema, request.query);
      return service.view(contextOf(request), query);
    },
  };
}

export type RoadmapController = ReturnType<typeof createRoadmapController>;
