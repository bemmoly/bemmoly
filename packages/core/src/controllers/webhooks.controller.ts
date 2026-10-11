import {
  createWebhookBodySchema,
  createWebhookDeliveryBodySchema,
  listWebhookDeliveriesQuerySchema,
  parseOrThrow,
  updateWebhookBodySchema,
  webhookIdParamsSchema,
  type Webhook,
  type WebhookCatalog,
  type WebhookDeliveriesPage,
  type WebhookDelivery,
  type WebhookTarget,
  type WebhookWithSecret,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { WebhookAdmin } from '../services/webhooks/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(webhookIdParamsSchema, request.params).id;

export function createWebhooksController(service: WebhookAdmin, actorOf: ActorResolver) {
  return {
    async catalog(request: FastifyRequest): Promise<WebhookCatalog> {
      return service.catalog(await actorOf(request));
    },
    async targets(request: FastifyRequest): Promise<{ items: WebhookTarget[] }> {
      return { items: await service.targets(await actorOf(request)) };
    },
    async list(request: FastifyRequest): Promise<{ items: Webhook[] }> {
      return { items: await service.list(await actorOf(request)) };
    },
    async get(request: FastifyRequest): Promise<Webhook> {
      return service.get(await actorOf(request), idOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<WebhookWithSecret> {
      const body = parseOrThrow(createWebhookBodySchema, request.body);
      const webhook = await service.create(await actorOf(request), body);
      reply.code(201);
      return webhook;
    },
    async update(request: FastifyRequest): Promise<Webhook> {
      const body = parseOrThrow(updateWebhookBodySchema, request.body);
      return service.update(await actorOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(await actorOf(request), idOf(request));
      reply.code(204).send();
    },
    async rotateSecret(request: FastifyRequest, reply: FastifyReply): Promise<WebhookWithSecret> {
      const webhook = await service.rotateSecret(await actorOf(request), idOf(request));
      reply.code(201);
      return webhook;
    },
    async deliveries(request: FastifyRequest): Promise<WebhookDeliveriesPage> {
      const query = parseOrThrow(listWebhookDeliveriesQuerySchema, request.query);
      return service.deliveries(await actorOf(request), idOf(request), query);
    },
    async deliver(request: FastifyRequest, reply: FastifyReply): Promise<WebhookDelivery> {
      const body = parseOrThrow(createWebhookDeliveryBodySchema, request.body);
      const delivery = await service.deliver(await actorOf(request), idOf(request), body);
      reply.code(201);
      return delivery;
    },
  };
}

export type WebhooksController = ReturnType<typeof createWebhooksController>;
