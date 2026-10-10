import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import {
  searchPagesQuerySchema,
  suggestPagesQuerySchema,
  type PageSearchResponse,
  type PageSuggestResponse,
} from '../../../shared/search.ts';
import type { SearchService } from '../services/search/index.ts';

export function createSearchController(service: SearchService) {
  return {
    async search(request: FastifyRequest): Promise<PageSearchResponse> {
      const query = parseOrThrow(searchPagesQuerySchema, request.query);
      return { items: await service.search(contextOf(request), query) };
    },
    async suggest(request: FastifyRequest): Promise<PageSuggestResponse> {
      const query = parseOrThrow(suggestPagesQuerySchema, request.query);
      return { items: await service.suggest(contextOf(request), query) };
    },
  };
}

export type SearchController = ReturnType<typeof createSearchController>;
