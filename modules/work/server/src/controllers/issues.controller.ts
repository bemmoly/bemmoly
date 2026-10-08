import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createWorkLogBodySchema, type Watcher, type WorkLog } from '../../../shared/activity.ts';
import { issueKeyParamsSchema } from '../../../shared/common.ts';
import {
  assignIssueBodySchema,
  createIssueBodySchema,
  listIssuesQuerySchema,
  rankIssueBodySchema,
  updateIssueBodySchema,
  watchIssueBodySchema,
  type Issue,
  type IssueDetail,
  type IssuesPage,
} from '../../../shared/issues.ts';
import type { IssuesService } from '../services/issues/index.ts';

const keyOf = (request: FastifyRequest) => parseOrThrow(issueKeyParamsSchema, request.params).key;

export function createIssuesController(service: IssuesService) {
  return {
    async list(request: FastifyRequest): Promise<IssuesPage> {
      const query = parseOrThrow(listIssuesQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Issue> {
      const body = parseOrThrow(createIssueBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async get(request: FastifyRequest): Promise<IssueDetail> {
      return service.get(contextOf(request), keyOf(request));
    },
    async update(request: FastifyRequest): Promise<Issue> {
      const body = parseOrThrow(updateIssueBodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), keyOf(request));
      reply.code(204).send();
    },
    async restore(request: FastifyRequest): Promise<Issue> {
      return service.restore(contextOf(request), keyOf(request));
    },
    async rank(request: FastifyRequest): Promise<Issue> {
      const body = parseOrThrow(rankIssueBodySchema, request.body);
      return service.rank(contextOf(request), keyOf(request), body);
    },
    async assign(request: FastifyRequest): Promise<Issue> {
      const { assigneeId } = parseOrThrow(assignIssueBodySchema, request.body);
      return service.assign(contextOf(request), keyOf(request), assigneeId);
    },
    async watchers(request: FastifyRequest): Promise<{ items: Watcher[] }> {
      return { items: await service.watchers(contextOf(request), keyOf(request)) };
    },
    async watch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { watching } = parseOrThrow(watchIssueBodySchema, request.body);
      await service.watch(contextOf(request), keyOf(request), watching);
      reply.code(204).send();
    },
    async workLogs(request: FastifyRequest): Promise<{ items: WorkLog[] }> {
      return { items: await service.workLogs(contextOf(request), keyOf(request)) };
    },
    async addWorkLog(request: FastifyRequest, reply: FastifyReply): Promise<WorkLog> {
      const body = parseOrThrow(createWorkLogBodySchema, request.body);
      reply.code(201);
      return service.addWorkLog(contextOf(request), keyOf(request), body);
    },
  };
}

export type IssuesController = ReturnType<typeof createIssuesController>;
