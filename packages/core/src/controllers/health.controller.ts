import type { LivenessResponse, ReadinessResponse } from '@bemmoly/shared';
import type { FastifyReply } from 'fastify';
import { checkReadiness, type ReadinessDependencies } from '../services/system/index.ts';

/** Probes read the status code, so readiness maps its own state rather than throwing. */
const READINESS_STATUS: Record<ReadinessResponse['status'], number> = {
  ready: 200,
  degraded: 200,
  unavailable: 503,
};

export function createHealthController(deps: ReadinessDependencies) {
  return {
    liveness(): LivenessResponse {
      return { status: 'ok' };
    },
    async readiness(reply: FastifyReply): Promise<ReadinessResponse> {
      const result = await checkReadiness(deps);
      reply.code(READINESS_STATUS[result.status]);
      return result;
    },
  };
}

export type HealthController = ReturnType<typeof createHealthController>;
