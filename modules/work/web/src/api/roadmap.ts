import {
  roadmapQuerySchema,
  roadmapViewSchema,
  updateVersionBodySchema,
  versionSchema,
  type RoadmapQueryInput,
  type UpdateVersionBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/**
 * The Roadmap's read and the one write it owns: a version's dates. Epics move through the
 * issue PATCH in issues.ts, so their history and realtime stay the issue's.
 */
export function workRoadmapEndpoints(http: Http) {
  return {
    roadmap: {
      view: async (query: RoadmapQueryInput = {}, options: { signal?: AbortSignal } = {}) =>
        http.request(`${BASE}/roadmap`, roadmapViewSchema, {
          query: validated(roadmapQuerySchema, query),
          ...(options.signal ? { signal: options.signal } : {}),
        }),
    },
    versions: {
      update: async (projectKey: string, id: string, body: UpdateVersionBody) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/versions/${enc(id)}`, versionSchema, {
          method: 'PATCH',
          body: validated(updateVersionBodySchema, body),
        }),
    },
  };
}
