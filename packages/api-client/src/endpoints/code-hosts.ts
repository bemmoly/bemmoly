import {
  codeHostBackfillSchema,
  codeHostDeliveriesResponseSchema,
  codeHostSchema,
  codeHostsResponseSchema,
  codeHostTestResultSchema,
  completeGithubAppSchema,
  createCodeHostSchema,
  githubAppCreatedSchema,
  githubAppStartSchema,
  installGithubAppSchema,
  startGithubAppSchema,
  updateCodeHostSchema,
  type CompleteGithubApp,
  type CreateCodeHostInput,
  type InstallGithubApp,
  type StartGithubAppInput,
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
    /** The manifest the browser posts to GitHub to create the app in one click. */
    startGithubApp: async (body: StartGithubAppInput) =>
      http.request(`${BASE}/github-app-manifests`, githubAppStartSchema, {
        method: 'POST',
        body: validated(startGithubAppSchema, body),
      }),
    /** GitHub's one-time code, back from creating the app, traded for the stored host. */
    completeGithubApp: async (body: CompleteGithubApp) =>
      http.request(`${BASE}/github-apps`, githubAppCreatedSchema, {
        method: 'POST',
        body: validated(completeGithubAppSchema, body),
      }),
    /** Where GitHub says the app was installed; the repositories are read from there. */
    installGithubApp: async (id: string, body: InstallGithubApp) =>
      http.request(host(id, '/installations'), codeHostSchema, {
        method: 'POST',
        body: validated(installGithubAppSchema, body),
      }),
    backfill: async (id: string) =>
      http.request(host(id, '/backfills'), codeHostBackfillSchema, { method: 'POST', body: {} }),
  };
}
