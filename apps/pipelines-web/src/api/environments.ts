import type { Http } from '@bemmoly/api-client';
import {
  environmentPathSchema,
  environmentSchema,
  type CreateEnvironmentBody,
  type SetPathBody,
  type Tier,
  type UpdateEnvironmentBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines/environments';

/**
 * Writes to environments and their paths. The reads stay with the shell's shared reads
 * (`pipelinesEndpoints`), under the `environments` key every write here invalidates.
 */
export function environmentEndpoints(http: Http) {
  return {
    create: (body: CreateEnvironmentBody) =>
      http.request(base, environmentSchema, { method: 'POST', body }),
    /** Only what the body names changes. */
    update: (key: string, body: UpdateEnvironmentBody) =>
      http.request(`${base}/${encodeURIComponent(key)}`, environmentSchema, {
        method: 'PATCH',
        body,
      }),
    archive: (key: string) => http.send(`${base}/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    setPath: (tier: Tier, body: SetPathBody) =>
      http.request(`${base}/paths/${tier}`, environmentPathSchema, { method: 'PUT', body }),
  };
}
