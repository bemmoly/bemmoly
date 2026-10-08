import { contextOf } from '@bemmoly/core';
import { idParamsSchema, parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { listIssueHistoryQuerySchema, type IssueHistoryPage } from '../../../shared/activity.ts';
import {
  createCommentBodySchema,
  listCommentsQuerySchema,
  reactToCommentBodySchema,
  updateCommentBodySchema,
  type Comment,
  type CommentsPage,
} from '../../../shared/comments.ts';
import { issueKeyParamsSchema } from '../../../shared/common.ts';
import { createIssueLinkBodySchema, type IssueLink } from '../../../shared/links-labels.ts';
import {
  searchQuerySchema,
  suggestQuerySchema,
  type SearchResponse,
  type SuggestResponse,
} from '../../../shared/search.ts';
import type { CommentsService } from '../services/comments/index.ts';
import type { HistoryService } from '../services/history/index.ts';
import type { LinksService } from '../services/links/index.ts';
import type { SearchService } from '../services/search/index.ts';

/*
 * What happens around an issue: comments, links, history and search. One
 * controller for the four small services so the composition stays one line.
 */

const keyOf = (request: FastifyRequest) => parseOrThrow(issueKeyParamsSchema, request.params).key;
const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

export interface ActivityServices {
  comments: CommentsService;
  links: LinksService;
  history: HistoryService;
  search: SearchService;
}

export function createActivityController(services: ActivityServices) {
  return {
    async listComments(request: FastifyRequest): Promise<CommentsPage> {
      const query = parseOrThrow(listCommentsQuerySchema, request.query);
      return services.comments.list(contextOf(request), keyOf(request), query);
    },
    async createComment(request: FastifyRequest, reply: FastifyReply): Promise<Comment> {
      const body = parseOrThrow(createCommentBodySchema, request.body);
      reply.code(201);
      return services.comments.create(contextOf(request), keyOf(request), body);
    },
    async updateComment(request: FastifyRequest): Promise<Comment> {
      const body = parseOrThrow(updateCommentBodySchema, request.body);
      return services.comments.update(contextOf(request), idOf(request), body);
    },
    async removeComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await services.comments.remove(contextOf(request), idOf(request));
      reply.code(204).send();
    },
    async react(request: FastifyRequest): Promise<Comment> {
      const body = parseOrThrow(reactToCommentBodySchema, request.body);
      return services.comments.react(contextOf(request), idOf(request), body);
    },
    async listLinks(request: FastifyRequest): Promise<{ items: IssueLink[] }> {
      return { items: await services.links.list(contextOf(request), keyOf(request)) };
    },
    async createLink(request: FastifyRequest, reply: FastifyReply): Promise<IssueLink> {
      const body = parseOrThrow(createIssueLinkBodySchema, request.body);
      reply.code(201);
      return services.links.create(contextOf(request), keyOf(request), body);
    },
    async removeLink(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await services.links.remove(contextOf(request), idOf(request));
      reply.code(204).send();
    },
    async history(request: FastifyRequest): Promise<IssueHistoryPage> {
      const query = parseOrThrow(listIssueHistoryQuerySchema, request.query);
      return services.history.list(contextOf(request), keyOf(request), query);
    },
    async search(request: FastifyRequest): Promise<SearchResponse> {
      const query = parseOrThrow(searchQuerySchema, request.query);
      return { items: await services.search.search(contextOf(request), query) };
    },
    async suggest(request: FastifyRequest): Promise<SuggestResponse> {
      const query = parseOrThrow(suggestQuerySchema, request.query);
      return { items: await services.search.suggest(contextOf(request), query) };
    },
  };
}

export type ActivityController = ReturnType<typeof createActivityController>;
