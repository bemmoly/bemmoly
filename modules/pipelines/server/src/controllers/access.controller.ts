import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  bindingParamsSchema,
  checkAccessBodySchema,
  createBindingBodySchema,
  createPolicyBodySchema,
  listBindingsQuerySchema,
  listDecisionsQuerySchema,
  listPoliciesQuerySchema,
  policyParamsSchema,
  policyVersionParamsSchema,
  updatePolicyBodySchema,
} from '../../../shared/access.ts';
import type { AccessService } from '../services/access/index.ts';

/** Bindings, policies and the checker under /api/v1/pipelines. */
export function createAccessController(service: AccessService) {
  return {
    bindings(request: FastifyRequest) {
      const query = parseOrThrow(listBindingsQuerySchema, request.query);
      return service.bindings.list(contextOf(request), query);
    },
    async createBinding(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createBindingBodySchema, request.body);
      const binding = await service.bindings.create(contextOf(request), body);
      reply.code(201);
      return binding;
    },
    async removeBinding(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(bindingParamsSchema, request.params);
      await service.bindings.remove(contextOf(request), id);
      reply.code(204);
    },
    policies(request: FastifyRequest) {
      const { scope } = parseOrThrow(listPoliciesQuerySchema, request.query);
      return service.policies.list(contextOf(request), scope);
    },
    async createPolicy(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createPolicyBodySchema, request.body);
      const policy = await service.policies.create(contextOf(request), body);
      reply.code(201);
      return policy;
    },
    updatePolicy(request: FastifyRequest) {
      const { id } = parseOrThrow(policyParamsSchema, request.params);
      const body = parseOrThrow(updatePolicyBodySchema, request.body);
      return service.policies.update(contextOf(request), id, body);
    },
    policyVersions(request: FastifyRequest) {
      const { id } = parseOrThrow(policyParamsSchema, request.params);
      return service.policies.versions(contextOf(request), id);
    },
    async approvePolicyVersion(request: FastifyRequest, reply: FastifyReply) {
      const { id, version } = parseOrThrow(policyVersionParamsSchema, request.params);
      const policy = await service.policies.approve(contextOf(request), id, version);
      reply.code(201);
      return policy;
    },
    decisions(request: FastifyRequest) {
      const query = parseOrThrow(listDecisionsQuerySchema, request.query);
      return service.decisions.list(contextOf(request), query);
    },
    check(request: FastifyRequest) {
      const body = parseOrThrow(checkAccessBodySchema, request.body);
      return service.check(contextOf(request), body);
    },
  };
}

export type AccessController = ReturnType<typeof createAccessController>;
