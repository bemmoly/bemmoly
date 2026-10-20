import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  acceptProposalsBodySchema,
  dismissProposalsBodySchema,
  listProposalsQuerySchema,
} from '../../../shared/catalog-writes.ts';
import { scanBodySchema } from '../../../shared/discovery.ts';
import type { DiscoveryService } from '../services/discovery/index.ts';

/** Discovery under /api/v1/pipelines: proposals, bulk accept and dismiss, scans, status. */
export function createDiscoveryController(service: DiscoveryService) {
  return {
    proposals(request: FastifyRequest) {
      const query = parseOrThrow(listProposalsQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
    async accept(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(acceptProposalsBodySchema, request.body);
      const result = await service.accept(contextOf(request), body);
      reply.code(201);
      return result;
    },
    async dismiss(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(dismissProposalsBodySchema, request.body);
      const result = await service.dismiss(contextOf(request), body);
      reply.code(201);
      return result;
    },
    async scan(request: FastifyRequest, reply: FastifyReply) {
      const { repository } = parseOrThrow(scanBodySchema, request.body ?? {});
      const result = await service.scan(contextOf(request), repository);
      reply.code(201);
      return result;
    },
    status(request: FastifyRequest) {
      return service.status(contextOf(request));
    },
  };
}

export type DiscoveryController = ReturnType<typeof createDiscoveryController>;
