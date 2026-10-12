import {
  pairingMatrixSchema,
  pairingQuerySchema,
  type PairingQuery,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

/** The Pairing view's one read: who shared issues with whom in a project, over a range. */
export function workPairingEndpoints(http: Http) {
  return {
    pairing: async (
      projectKey: string,
      query: PairingQuery = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      http.request(`/api/v1/work/projects/${enc(projectKey)}/pairing`, pairingMatrixSchema, {
        query: validated(pairingQuerySchema, query),
        ...(options.signal ? { signal: options.signal } : {}),
      }),
  };
}
