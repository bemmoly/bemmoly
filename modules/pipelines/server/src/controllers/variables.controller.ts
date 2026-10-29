import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applicationKeyParamsSchema } from '../../../shared/catalog.ts';
import {
  setVariableBodySchema,
  variableListQuerySchema,
  variableParamsSchema,
  variableTargetQuerySchema,
} from '../../../shared/variables.ts';
import type { VariablesService } from '../services/variables/index.ts';

/** An application's variables and secrets. A request body with a value is never logged. */
export function createVariablesController(variables: VariablesService) {
  const targetOf = (request: FastifyRequest) => {
    const { key, name } = parseOrThrow(variableParamsSchema, request.params);
    const { environment } = parseOrThrow(variableTargetQuerySchema, request.query);
    return { application: key, name, ...(environment ? { environment } : {}) };
  };
  return {
    list(request: FastifyRequest) {
      const { key } = parseOrThrow(applicationKeyParamsSchema, request.params);
      const query = parseOrThrow(variableListQuerySchema, request.query);
      return variables.list(contextOf(request), key, query);
    },
    set(request: FastifyRequest) {
      const body = parseOrThrow(setVariableBodySchema, request.body);
      return variables.set(contextOf(request), targetOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await variables.remove(contextOf(request), targetOf(request));
      reply.code(204);
    },
  };
}

export type VariablesController = ReturnType<typeof createVariablesController>;
