import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createSampleItemBodySchema,
  createSamplePingBodySchema,
  type SampleItem,
  type SamplePingResponse,
} from '../../../shared/schemas.ts';
import type { ItemsService } from '../services/items.ts';

export function createItemsController(service: ItemsService) {
  return {
    async list(): Promise<{ items: SampleItem[] }> {
      return { items: await service.list() };
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<SampleItem> {
      const { label } = parseOrThrow(createSampleItemBodySchema, request.body);
      reply.code(201);
      return service.create(label);
    },
    async ping(request: FastifyRequest, reply: FastifyReply): Promise<SamplePingResponse> {
      const { idempotencyKey } = parseOrThrow(createSamplePingBodySchema, request.body ?? {});
      reply.code(202);
      return service.ping(idempotencyKey);
    },
    async greeting(): Promise<{ greeting: string }> {
      return { greeting: await service.greeting() };
    },
  };
}

export type ItemsController = ReturnType<typeof createItemsController>;
