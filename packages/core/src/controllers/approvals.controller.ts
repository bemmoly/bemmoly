import { parseOrThrow } from '@bemmoly/shared';
import {
  decideApprovalBodySchema,
  delegationBodySchema,
  listApprovalsQuerySchema,
  saveWorkflowBodySchema,
  withdrawApprovalBodySchema,
  type ApprovalDelegation,
  type ApprovalRequest,
  type ApprovalRequestPage,
  type ApprovalWorkflow,
} from '@bemmoly/shared/approvals';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ActorResolver } from '../middlewares/actor.ts';
import type { ApprovalsService } from '../services/approvals/index.ts';

const idParamsSchema = z.object({ id: z.uuid() });
const workflowQuerySchema = z.object({ moduleId: z.string().max(64).optional() });

const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

export function createApprovalsController(service: ApprovalsService, actorOf: ActorResolver) {
  return {
    async list(request: FastifyRequest): Promise<ApprovalRequestPage> {
      const query = parseOrThrow(listApprovalsQuerySchema, request.query);
      return service.list(await actorOf(request), query);
    },
    async get(request: FastifyRequest): Promise<ApprovalRequest> {
      return service.get(await actorOf(request), idOf(request));
    },
    async decide(request: FastifyRequest, reply: FastifyReply): Promise<ApprovalRequest> {
      const body = parseOrThrow(decideApprovalBodySchema, request.body);
      const result = await service.decide(await actorOf(request), idOf(request), body);
      reply.code(201);
      return result;
    },
    async withdraw(request: FastifyRequest): Promise<ApprovalRequest> {
      const body = parseOrThrow(withdrawApprovalBodySchema, request.body ?? {});
      return service.withdraw(await actorOf(request), idOf(request), body);
    },
    async delegation(request: FastifyRequest): Promise<{ delegation: ApprovalDelegation | null }> {
      return { delegation: await service.delegation(await actorOf(request)) };
    },
    async setDelegation(request: FastifyRequest): Promise<{ delegation: ApprovalDelegation }> {
      const body = parseOrThrow(delegationBodySchema, request.body);
      return { delegation: await service.setDelegation(await actorOf(request), body) };
    },
    async clearDelegation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.clearDelegation(await actorOf(request));
      reply.code(204).send();
    },
    async workflows(request: FastifyRequest): Promise<{ items: ApprovalWorkflow[] }> {
      const { moduleId } = parseOrThrow(workflowQuerySchema, request.query);
      return { items: await service.workflows.list(await actorOf(request), moduleId) };
    },
    async workflow(request: FastifyRequest): Promise<ApprovalWorkflow> {
      return service.workflows.get(await actorOf(request), idOf(request));
    },
    async saveWorkflow(request: FastifyRequest, reply: FastifyReply): Promise<ApprovalWorkflow> {
      const body = parseOrThrow(saveWorkflowBodySchema, request.body);
      const workflow = await service.workflows.save(await actorOf(request), body);
      reply.code(201);
      return workflow;
    },
  };
}

export type ApprovalsController = ReturnType<typeof createApprovalsController>;
