import {
  enableModuleBodySchema,
  moduleIdParamsSchema,
  parseOrThrow,
  removeModuleDataBodySchema,
  type AdminModule,
  type AdminModulesResponse,
  type ModulesResponse,
} from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { ModuleAccessResolver } from '../contracts/module-access.ts';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import {
  listModuleManifests,
  type ModuleAdmin,
  type ModuleState,
} from '../services/modules/index.ts';
import { metaOf } from './request-context.ts';

export interface ModulesControllerDeps {
  registry: ModuleRegistry;
  state?: ModuleState;
  access?: ModuleAccessResolver;
  /** Absent when identity is not wired: the list is not filtered by person. */
  actorOf?: ActorResolver;
}

export function createModulesController(deps: ModulesControllerDeps) {
  return {
    async list(request: FastifyRequest): Promise<ModulesResponse> {
      const actor = deps.actorOf ? await deps.actorOf(request) : undefined;
      const items = await listModuleManifests(deps.registry, {
        ...(deps.state ? { enabled: deps.state.enabledIds() } : {}),
        ...(actor ? { actor } : {}),
        ...(deps.access ? { access: deps.access } : {}),
      });
      return { items };
    },
  };
}

export function createModuleAdminController(admin: ModuleAdmin, actorOf: ActorResolver) {
  const idOf = (request: FastifyRequest) => parseOrThrow(moduleIdParamsSchema, request.params).id;
  return {
    async list(request: FastifyRequest): Promise<AdminModulesResponse> {
      return admin.list(await actorOf(request));
    },
    async get(request: FastifyRequest): Promise<AdminModule> {
      return admin.get(await actorOf(request), idOf(request));
    },
    async enable(request: FastifyRequest): Promise<AdminModule> {
      const { access } = parseOrThrow(enableModuleBodySchema, request.body ?? {});
      return admin.enable(await actorOf(request), idOf(request), access, metaOf(request));
    },
    async disable(request: FastifyRequest): Promise<AdminModule> {
      return admin.disable(await actorOf(request), idOf(request), metaOf(request));
    },
    async removeData(request: FastifyRequest): Promise<AdminModule> {
      const { confirm } = parseOrThrow(removeModuleDataBodySchema, request.body);
      return admin.removeData(await actorOf(request), idOf(request), confirm, metaOf(request));
    },
  };
}

export type ModulesController = ReturnType<typeof createModulesController>;
export type ModuleAdminController = ReturnType<typeof createModuleAdminController>;
