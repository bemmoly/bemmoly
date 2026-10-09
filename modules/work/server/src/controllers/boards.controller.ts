import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  boardViewQuerySchema,
  createBoardBodySchema,
  listBoardsQuerySchema,
  projectRefParamsSchema,
  updateBoardBodySchema,
  type Board,
  type BoardView,
} from '../../../shared/boards.ts';
import type { BoardsService } from '../services/boards/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createBoardsController(service: BoardsService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async listForProject(request: FastifyRequest): Promise<{ items: Board[] }> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      return { items: await service.listForProject(contextOf(request), key) };
    },
    async list(request: FastifyRequest): Promise<{ items: Board[] }> {
      const { projectId } = parseOrThrow(listBoardsQuerySchema, request.query);
      return { items: await service.list(contextOf(request), projectId) };
    },
    async get(request: FastifyRequest): Promise<Board> {
      return service.get(contextOf(request), id(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Board> {
      const body = parseOrThrow(createBoardBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<Board> {
      const body = parseOrThrow(updateBoardBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), id(request));
      reply.code(204).send();
    },
    async view(request: FastifyRequest): Promise<BoardView> {
      const query = parseOrThrow(boardViewQuerySchema, request.query);
      return service.view(contextOf(request), id(request), query);
    },
  };
}

export type BoardsController = ReturnType<typeof createBoardsController>;
