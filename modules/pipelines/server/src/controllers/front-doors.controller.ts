import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { environmentKeyParamsSchema } from '../../../shared/environments.ts';
import { frontDoorsQuerySchema, setFrontDoorBodySchema } from '../../../shared/front-doors.ts';
import {
  moveActionBodySchema,
  runtimeMoveParamsSchema,
  runtimeMovesQuerySchema,
} from '../../../shared/moves.ts';
import type { FrontDoorsService } from '../services/front-doors/index.ts';
import type { MovesService } from '../services/moves/index.ts';

/** Front doors per environment, and the runtime moves that go through them. */
export function createFrontDoorsController(frontDoors: FrontDoorsService, moves: MovesService) {
  const environmentOf = (request: FastifyRequest) =>
    parseOrThrow(environmentKeyParamsSchema, request.params).key;
  const idOf = (request: FastifyRequest) =>
    parseOrThrow(runtimeMoveParamsSchema, request.params).id;
  return {
    list: (request: FastifyRequest) =>
      frontDoors.list(contextOf(request), parseOrThrow(frontDoorsQuerySchema, request.query)),
    set: (request: FastifyRequest) =>
      frontDoors.set(
        contextOf(request),
        environmentOf(request),
        parseOrThrow(setFrontDoorBodySchema, request.body),
      ),
    moves: (request: FastifyRequest) =>
      moves.list(contextOf(request), parseOrThrow(runtimeMovesQuerySchema, request.query)),
    move: (request: FastifyRequest) => moves.get(contextOf(request), idOf(request)),
    start: (request: FastifyRequest) => moves.start(contextOf(request), idOf(request)),
    pause: (request: FastifyRequest) => moves.pause(contextOf(request), idOf(request)),
    resume: (request: FastifyRequest) => moves.resume(contextOf(request), idOf(request)),
    rollback(request: FastifyRequest) {
      const body = parseOrThrow(moveActionBodySchema, request.body ?? {});
      return moves.rollback(contextOf(request), idOf(request), body.reason);
    },
  };
}

export type FrontDoorsController = ReturnType<typeof createFrontDoorsController>;
