import {
  createCodeHostSchema,
  idParamsSchema,
  parseOrThrow,
  updateCodeHostSchema,
  type CodeHost,
  type CodeHostBackfill,
  type CodeHostDeliveriesResponse,
  type CodeHostsResponse,
  type CodeHostTestResult,
  type CodeWebhookReceipt,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { CodeHosts } from '../services/code-hosts/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

/** Settings › Integrations › Code hosts, and the hosts' own webhook deliveries. */
export function createCodeHostsController(codeHosts: CodeHosts, actorOf: ActorResolver) {
  const { service } = codeHosts;
  return {
    async list(request: FastifyRequest): Promise<CodeHostsResponse> {
      return { items: await service.list(await actorOf(request)) };
    },
    async get(request: FastifyRequest): Promise<CodeHost> {
      return service.get(await actorOf(request), idOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<CodeHost> {
      const body = parseOrThrow(createCodeHostSchema, request.body);
      const created = await service.create(await actorOf(request), body);
      reply.code(201);
      return created;
    },
    async update(request: FastifyRequest): Promise<CodeHost> {
      const body = parseOrThrow(updateCodeHostSchema, request.body);
      return service.update(await actorOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(await actorOf(request), idOf(request));
      reply.code(204).send();
    },
    async deliveries(request: FastifyRequest): Promise<CodeHostDeliveriesResponse> {
      return { items: await service.deliveries(await actorOf(request), idOf(request)) };
    },
    async test(request: FastifyRequest, reply: FastifyReply): Promise<CodeHostTestResult> {
      const result = await service.test(await actorOf(request), idOf(request));
      reply.code(201);
      return result;
    },
    async backfill(request: FastifyRequest, reply: FastifyReply): Promise<CodeHostBackfill> {
      const result = await service.backfill(await actorOf(request), idOf(request));
      reply.code(202);
      return result;
    },
    /** Anonymous by design: the signature over the raw body is the credential. */
    async webhook(request: FastifyRequest): Promise<CodeWebhookReceipt> {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      return codeHosts.receive(idOf(request), { headers: request.headers, body });
    },
  };
}

export type CodeHostsController = ReturnType<typeof createCodeHostsController>;
