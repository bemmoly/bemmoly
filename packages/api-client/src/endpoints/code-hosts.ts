import {
  codeHostBackfillSchema,
  codeHostDeliveriesResponseSchema,
  codeHostSchema,
  codeHostsResponseSchema,
  codeHostTestResultSchema,
  createCodeHostSchema,
  updateCodeHostSchema,
  type CreateCodeHostInput,
  type UpdateCodeHostInput,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const BASE = '/api/v1/admin/code-hosts';

/** Settings › Integrations › Code hosts: connect GitHub or GitLab, test, backfill. */
export function codeHostEndpoints(http: Http) {
  const host = (id: string, rest = '') => `${BASE}/${enc(id)}${rest}`;
  return {
    list: async () => (await http.request(BASE, codeHostsResponseSchema)).items,
    create: async (body: CreateCodeHostInput) =>
      http.request(BASE, codeHostSchema, {
        method: 'POST',
        body: validated(createCodeHostSchema, body),
      }),
    update: async (id: string, body: UpdateCodeHostInput) =>
      http.request(host(id), codeHostSchema, {
        method: 'PATCH',
        body: validated(updateCodeHostSchema, body),
      }),
    remove: async (id: string) => http.send(host(id), { method: 'DELETE' }),
    deliveries: async (id: string) =>
      (await http.request(host(id, '/deliveries'), codeHostDeliveriesResponseSchema)).items,
    /** A signed ping through the webhook path, then one API call with the saved credentials. */
    test: async (id: string) =>
      http.request(host(id, '/tests'), codeHostTestResultSchema, { method: 'POST', body: {} }),
    backfill: async (id: string) =>
      http.request(host(id, '/backfills'), codeHostBackfillSchema, { method: 'POST', body: {} }),
  };
}
