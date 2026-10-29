import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { idParamsSchema, queryFlagSchema } from '../../../shared/common.ts';
import {
  absencesQuerySchema,
  balancesQuerySchema,
  createLeavePolicyBodySchema,
  createLeaveRequestBodySchema,
  listLeaveRequestsQuerySchema,
  updateLeavePolicyBodySchema,
} from '../../../shared/leave.ts';
import type { LeaveService } from '../services/leave/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;
const policiesQuerySchema = z.object({ includeArchived: queryFlagSchema.optional() });

export function createLeaveController(service: LeaveService) {
  return {
    async listPolicies(request: FastifyRequest) {
      const query = parseOrThrow(policiesQuerySchema, request.query);
      return {
        items: await service.policies.list({ includeArchived: query.includeArchived ?? false }),
      };
    },
    async createPolicy(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createLeavePolicyBodySchema, request.body);
      reply.code(201);
      return service.policies.create(contextOf(request), body);
    },
    async updatePolicy(request: FastifyRequest) {
      const body = parseOrThrow(updateLeavePolicyBodySchema, request.body);
      return service.policies.update(contextOf(request), idOf(request), body);
    },
    async listRequests(request: FastifyRequest) {
      const query = parseOrThrow(listLeaveRequestsQuerySchema, request.query);
      return { items: await service.requests.list(contextOf(request), query) };
    },
    async createRequest(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createLeaveRequestBodySchema, request.body);
      reply.code(201);
      return service.requests.create(contextOf(request), body);
    },
    async withdrawRequest(request: FastifyRequest) {
      return service.requests.withdraw(contextOf(request), idOf(request));
    },
    async balances(request: FastifyRequest) {
      const query = parseOrThrow(balancesQuerySchema, request.query);
      return { items: await service.balances.list(contextOf(request), query) };
    },
    async absences(request: FastifyRequest) {
      const query = parseOrThrow(absencesQuerySchema, request.query);
      return { items: await service.absences.list(contextOf(request), query) };
    },
  };
}

export type LeaveController = ReturnType<typeof createLeaveController>;
