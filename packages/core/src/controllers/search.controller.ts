import { parseOrThrow, searchRequestQuerySchema, type SearchResponse } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { SearchService } from '../services/search/index.ts';
import { contextOf } from './request-context.ts';

export function createSearchController(service: SearchService) {
  return {
    async search(request: FastifyRequest): Promise<SearchResponse> {
      const query = parseOrThrow(searchRequestQuerySchema, request.query);
      return { items: await service.search(contextOf(request), query) };
    },
  };
}

export type SearchController = ReturnType<typeof createSearchController>;
