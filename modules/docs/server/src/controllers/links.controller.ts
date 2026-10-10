import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import {
  referencesQuerySchema,
  setLinksBodySchema,
  type BacklinksResponse,
  type OutgoingLinksResponse,
  type PageReferencesResponse,
} from '../../../shared/links.ts';
import type { LinksService } from '../services/links/index.ts';
import { pageIdOf } from './pages.controller.ts';

export function createLinksController(service: LinksService) {
  return {
    async outgoing(request: FastifyRequest): Promise<OutgoingLinksResponse> {
      return service.outgoing(contextOf(request), pageIdOf(request));
    },
    async setLinked(request: FastifyRequest): Promise<OutgoingLinksResponse> {
      const body = parseOrThrow(setLinksBodySchema, request.body);
      return service.setLinked(contextOf(request), pageIdOf(request), body);
    },
    async backlinks(request: FastifyRequest): Promise<BacklinksResponse> {
      return service.backlinks(contextOf(request), pageIdOf(request));
    },
    async references(request: FastifyRequest): Promise<PageReferencesResponse> {
      return service.references(contextOf(request), pageIdOf(request));
    },
    async linkedDocs(request: FastifyRequest): Promise<BacklinksResponse> {
      const query = parseOrThrow(referencesQuerySchema, request.query);
      return service.linkedDocs(contextOf(request), query);
    },
  };
}

export type LinksController = ReturnType<typeof createLinksController>;
