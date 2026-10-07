import {
  parseOrThrow,
  putSettingBodySchema,
  settingKeyParamsSchema,
  type SettingResponse,
  type SettingsListResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { SettingsAdmin } from '../services/settings/index.ts';

export function createSettingsController(admin: SettingsAdmin, actorOf: ActorResolver) {
  const keyOf = (request: FastifyRequest) =>
    parseOrThrow(settingKeyParamsSchema, request.params).key;
  return {
    async list(request: FastifyRequest): Promise<SettingsListResponse> {
      return { items: await admin.list(await actorOf(request)) };
    },
    async get(request: FastifyRequest): Promise<SettingResponse> {
      return admin.get(await actorOf(request), keyOf(request));
    },
    async put(request: FastifyRequest): Promise<SettingResponse> {
      const key = keyOf(request);
      const { value } = parseOrThrow(putSettingBodySchema, request.body);
      return admin.put(await actorOf(request), key, value);
    },
    async reset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await admin.reset(await actorOf(request), keyOf(request));
      reply.code(204);
    },
  };
}

export type SettingsController = ReturnType<typeof createSettingsController>;
