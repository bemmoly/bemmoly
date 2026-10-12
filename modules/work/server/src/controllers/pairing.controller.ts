import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import { pairingQuerySchema, type PairingMatrix } from '../../../shared/pairing.ts';
import type { PairingService } from '../services/pairing/index.ts';

export function createPairingController(service: PairingService) {
  return {
    async matrix(request: FastifyRequest): Promise<PairingMatrix> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      const query = parseOrThrow(pairingQuerySchema, request.query);
      return service.matrix(contextOf(request), key, query);
    },
  };
}

export type PairingController = ReturnType<typeof createPairingController>;
