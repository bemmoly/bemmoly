import {
  createModuleGrantSchema,
  createRoleSchema,
  idParamsSchema,
  listModuleGrantsQuerySchema,
  parseOrThrow,
  putRoleCapabilitiesSchema,
  updateRoleSchema,
  type CapabilityMatrix,
  type ModuleGrant,
  type ModuleGrantsResponse,
  type Role,
  type RoleCapabilitiesResponse,
  type RolesResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../clients/drizzle.ts';
import {
  createModuleGrant,
  createRole,
  deleteModuleGrant,
  deleteRole,
  getCapabilityMatrix,
  getModuleGrant,
  getRole,
  getRoleCapabilities,
  listModuleGrants,
  listRoles,
  putRoleCapabilities,
  updateRole,
  type ModuleCatalog,
} from '../services/authz/index.ts';
import { contextOf } from './request-context.ts';

export interface AuthzControllerDependencies {
  db: Database;
  modules: ModuleCatalog;
}

/** Roles, the capability matrix and module grants. */
export function createAuthzController({ db, modules }: AuthzControllerDependencies) {
  const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;
  return {
    async listRoles(request: FastifyRequest): Promise<RolesResponse> {
      contextOf(request);
      return { items: await listRoles(db) };
    },

    async getRole(request: FastifyRequest): Promise<Role> {
      contextOf(request);
      return getRole(db, idOf(request));
    },

    async createRole(request: FastifyRequest, reply: FastifyReply): Promise<Role> {
      const input = parseOrThrow(createRoleSchema, request.body);
      const role = await createRole(db, modules, contextOf(request), input);
      reply.code(201);
      return role;
    },

    async updateRole(request: FastifyRequest): Promise<Role> {
      const input = parseOrThrow(updateRoleSchema, request.body);
      return updateRole(db, contextOf(request), idOf(request), input);
    },

    async deleteRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await deleteRole(db, contextOf(request), idOf(request));
      reply.code(204).send();
    },

    async getRoleCapabilities(request: FastifyRequest): Promise<RoleCapabilitiesResponse> {
      return getRoleCapabilities(db, modules, contextOf(request), idOf(request));
    },

    async putRoleCapabilities(request: FastifyRequest): Promise<RoleCapabilitiesResponse> {
      const input = parseOrThrow(putRoleCapabilitiesSchema, request.body);
      return putRoleCapabilities(db, modules, contextOf(request), idOf(request), input);
    },

    async capabilityMatrix(request: FastifyRequest): Promise<CapabilityMatrix> {
      return getCapabilityMatrix(db, modules, contextOf(request));
    },

    async listModuleGrants(request: FastifyRequest): Promise<ModuleGrantsResponse> {
      const query = parseOrThrow(listModuleGrantsQuerySchema, request.query);
      return { items: await listModuleGrants(db, contextOf(request), query) };
    },

    async getModuleGrant(request: FastifyRequest): Promise<ModuleGrant> {
      return getModuleGrant(db, contextOf(request), idOf(request));
    },

    async createModuleGrant(request: FastifyRequest, reply: FastifyReply): Promise<ModuleGrant> {
      const input = parseOrThrow(createModuleGrantSchema, request.body);
      const grant = await createModuleGrant(db, modules, contextOf(request), input);
      reply.code(201);
      return grant;
    },

    async deleteModuleGrant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await deleteModuleGrant(db, contextOf(request), idOf(request));
      reply.code(204).send();
    },
  };
}

export type AuthzController = ReturnType<typeof createAuthzController>;
