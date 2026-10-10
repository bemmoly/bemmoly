import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { PageDetail } from '../../../shared/pages.ts';
import { setReviewersBodySchema, setStatusBodySchema } from '../../../shared/status.ts';
import {
  movePageBodySchema,
  treeQuerySchema,
  type MoveResult,
  type TreePage,
} from '../../../shared/tree.ts';
import type { StatusService } from '../services/status/index.ts';
import type { TreeService } from '../services/tree/index.ts';
import { pageIdOf } from './pages.controller.ts';
import { spaceRefOf } from './spaces.controller.ts';

/** Where a page sits and what state it is in: the tree, moves, status and reviewers. */
export function createTreeController(tree: TreeService, status: StatusService) {
  return {
    async children(request: FastifyRequest): Promise<TreePage> {
      const query = parseOrThrow(treeQuerySchema, request.query);
      return tree.children(contextOf(request), spaceRefOf(request), query);
    },
    async move(request: FastifyRequest): Promise<MoveResult> {
      const body = parseOrThrow(movePageBodySchema, request.body);
      return tree.move(contextOf(request), pageIdOf(request), body);
    },
    async setStatus(request: FastifyRequest): Promise<PageDetail> {
      const body = parseOrThrow(setStatusBodySchema, request.body);
      return status.setStatus(contextOf(request), pageIdOf(request), body);
    },
    async setReviewers(request: FastifyRequest): Promise<PageDetail> {
      const body = parseOrThrow(setReviewersBodySchema, request.body);
      return status.setReviewers(contextOf(request), pageIdOf(request), body);
    },
  };
}

export type TreeController = ReturnType<typeof createTreeController>;
