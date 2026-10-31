import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  deploySettingsParamsSchema,
  setDeploySettingsBodySchema,
} from '../../../shared/deploy-settings.ts';
import { environmentKeyParamsSchema } from '../../../shared/environments.ts';
import type { DeploySettingsService } from '../services/deploy-settings/index.ts';

/** Deploy settings per application and environment, and who follows an environment's default. */
export function createDeploySettingsController(settings: DeploySettingsService) {
  return {
    list(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      return settings.list(contextOf(request), key);
    },
    set(request: FastifyRequest) {
      const params = parseOrThrow(deploySettingsParamsSchema, request.params);
      const body = parseOrThrow(setDeploySettingsBodySchema, request.body);
      return settings.set(contextOf(request), params.key, params.environment, body);
    },
    async clear(request: FastifyRequest, reply: FastifyReply) {
      const params = parseOrThrow(deploySettingsParamsSchema, request.params);
      await settings.clear(contextOf(request), params.key, params.environment);
      reply.code(204);
    },
    environmentRuntimes(request: FastifyRequest) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      return settings.environmentRuntimes(contextOf(request), key);
    },
  };
}

export type DeploySettingsController = ReturnType<typeof createDeploySettingsController>;
