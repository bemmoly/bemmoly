import type { Http } from '@bemmoly/api-client';
import {
  frontDoorSchema,
  frontDoorsResponseSchema,
  runtimeMoveSchema,
  runtimeMovesResponseSchema,
  type SetFrontDoorBody,
} from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

const base = '/api/v1/pipelines';

/** A front door per environment, and the runtime moves that go through them. */
export const frontDoorKeys = {
  all: ['pipelines', 'front-doors'] as const,
  list: (application?: string) => [...frontDoorKeys.all, application ?? null] as const,
  moves: (application: string) => ['pipelines', 'runtime-moves', application] as const,
  move: (id: string) => ['pipelines', 'runtime-move', id] as const,
};

export type MoveVerb = 'start' | 'pause' | 'continue' | 'rollback';

export function frontDoorEndpoints(http: Http) {
  return {
    list: (application?: string) =>
      http.request(`${base}/front-doors`, frontDoorsResponseSchema, {
        query: toQuery({ application }),
      }),
    set: (environment: string, body: SetFrontDoorBody) =>
      http.request(
        `${base}/environments/${encodeURIComponent(environment)}/front-door`,
        frontDoorSchema,
        { method: 'PUT', body },
      ),
    moves: (application: string) =>
      http.request(`${base}/runtime-moves`, runtimeMovesResponseSchema, {
        query: toQuery({ application }),
      }),
    move: (id: string) => http.request(`${base}/runtime-moves/${id}`, runtimeMoveSchema),
    act: (id: string, verb: MoveVerb) =>
      http.request(`${base}/runtime-moves/${id}/${verb}`, runtimeMoveSchema, {
        method: 'POST',
        body: {},
      }),
  };
}
