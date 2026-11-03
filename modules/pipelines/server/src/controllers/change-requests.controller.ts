import { contextOf } from '@bemmoly/core';
import { parseOrThrow, ProviderError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  approveChangeRequestBodySchema,
  changeRequestNumberSchema,
  createChangeRequestBodySchema,
  listChangeRequestsQuerySchema,
  rejectChangeRequestBodySchema,
  updateChangeRequestBodySchema,
  withdrawChangeRequestBodySchema,
} from '../../../shared/change-requests.ts';
import { changeRequestOptionsQuerySchema } from '../../../shared/change-request-options.ts';
import type { ChangeRequestsService } from '../services/change-requests/index.ts';

const paramsSchema = z.object({ number: changeRequestNumberSchema });

/** Change requests: validate, call one service function, shape. */
export function createChangeRequestsController(service: ChangeRequestsService | undefined) {
  const requests = () => {
    if (!service) throw new ProviderError('Pipelines needs the database');
    return service;
  };
  const number = (request: FastifyRequest) => parseOrThrow(paramsSchema, request.params).number;

  return {
    list: (request: FastifyRequest) =>
      requests().list(
        contextOf(request),
        parseOrThrow(listChangeRequestsQuerySchema, request.query),
      ),
    options: (request: FastifyRequest) =>
      requests().options(
        contextOf(request),
        parseOrThrow(changeRequestOptionsQuerySchema, request.query),
      ),
    get: (request: FastifyRequest) => requests().get(contextOf(request), number(request)),
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createChangeRequestBodySchema, request.body);
      const created = await requests().create(contextOf(request), body);
      reply.code(201);
      return created;
    },
    update: (request: FastifyRequest) =>
      requests().update(
        contextOf(request),
        number(request),
        parseOrThrow(updateChangeRequestBodySchema, request.body),
      ),
    send: (request: FastifyRequest) => requests().send(contextOf(request), number(request)),
    approve: (request: FastifyRequest) =>
      requests().approve(
        contextOf(request),
        number(request),
        parseOrThrow(approveChangeRequestBodySchema, request.body ?? {}).note ?? null,
      ),
    reject: (request: FastifyRequest) =>
      requests().reject(
        contextOf(request),
        number(request),
        parseOrThrow(rejectChangeRequestBodySchema, request.body),
      ),
    withdraw: (request: FastifyRequest) =>
      requests().withdraw(
        contextOf(request),
        number(request),
        parseOrThrow(withdrawChangeRequestBodySchema, request.body ?? {}).reason ?? null,
      ),
  };
}

export type ChangeRequestsController = ReturnType<typeof createChangeRequestsController>;
