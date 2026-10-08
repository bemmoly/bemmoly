import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createWorkflowBodySchema,
  issueKeyParamsSchema,
  publishWorkflowBodySchema,
  putWorkflowDraftBodySchema,
  updateWorkflowBodySchema,
  type IssueTransitionsResponse,
  type Workflow,
  type WorkflowDraft,
  type WorkflowRulesResponse,
  type WorkflowStatus,
  type WorkflowTransition,
  type WorkflowValidationResponse,
} from '../../../shared/index.ts';
import type { WorkflowService } from '../services/workflow/index.ts';

const idParams = z.object({ id: z.uuid() });
const listQuery = z.object({ projectId: z.uuid().optional() });

export function createWorkflowController(service: WorkflowService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async list(request: FastifyRequest): Promise<{ items: Workflow[] }> {
      const { projectId } = parseOrThrow(listQuery, request.query);
      return { items: await service.list(contextOf(request), projectId) };
    },
    async get(request: FastifyRequest): Promise<Workflow> {
      return service.get(contextOf(request), id(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Workflow> {
      const body = parseOrThrow(createWorkflowBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<Workflow> {
      const body = parseOrThrow(updateWorkflowBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async statuses(request: FastifyRequest): Promise<{ items: WorkflowStatus[] }> {
      return { items: await service.statuses(contextOf(request), id(request)) };
    },
    async transitions(request: FastifyRequest): Promise<{ items: WorkflowTransition[] }> {
      return { items: await service.transitions(contextOf(request), id(request)) };
    },
    async getDraft(request: FastifyRequest): Promise<{ draft: WorkflowDraft }> {
      return { draft: await service.getDraft(contextOf(request), id(request)) };
    },
    async putDraft(request: FastifyRequest): Promise<{ draft: WorkflowDraft }> {
      const { draft } = parseOrThrow(putWorkflowDraftBodySchema, request.body);
      return { draft: await service.putDraft(contextOf(request), id(request), draft) };
    },
    async validate(request: FastifyRequest): Promise<WorkflowValidationResponse> {
      return service.validate(contextOf(request), id(request));
    },
    async publish(request: FastifyRequest): Promise<Workflow> {
      const body = parseOrThrow(publishWorkflowBodySchema, request.body ?? {});
      return service.publish(contextOf(request), id(request), body);
    },
    async issueTransitions(request: FastifyRequest): Promise<IssueTransitionsResponse> {
      const { key } = parseOrThrow(issueKeyParamsSchema, request.params);
      return { items: await service.issueTransitions(contextOf(request), key) };
    },
    async rules(request: FastifyRequest): Promise<WorkflowRulesResponse> {
      return { items: await service.rules(contextOf(request)) };
    },
  };
}

export type WorkflowController = ReturnType<typeof createWorkflowController>;
