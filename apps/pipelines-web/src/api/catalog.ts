import type { Http } from '@bemmoly/api-client';
import {
  domainSchema,
  groupSchema,
  type CreateDomainBody,
  type CreateGroupBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines';

/**
 * Writes to the catalog's structure: domains and the groups inside them. The reads stay with
 * the shell's shared reads (`pipelinesEndpoints`), under the keys every write here invalidates.
 */
export function catalogEndpoints(http: Http) {
  return {
    createDomain: (body: CreateDomainBody) =>
      http.request(`${base}/domains`, domainSchema, { method: 'POST', body }),
    createGroup: (body: CreateGroupBody) =>
      http.request(`${base}/groups`, groupSchema, { method: 'POST', body }),
  };
}
