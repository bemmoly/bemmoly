import type { Http } from '@bemmoly/api-client';
import {
  applicationDeploySettingsResponseSchema,
  applicationDeploySettingsSchema,
  environmentRuntimesResponseSchema,
  type SetDeploySettingsBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines';

/** Under the application's own key, so a deploy's refresh of the page refreshes them too. */
export const deploySettingsKeys = {
  list: (application: string) => ['pipelines', 'application', application, 'settings'] as const,
  followers: (environment: string) =>
    ['pipelines', 'platform', 'environment-runtimes', environment] as const,
};

/** Deploy settings per environment, and who follows an environment's default runtime. */
export function deploySettingsEndpoints(http: Http) {
  const pathOf = (application: string, environment: string) =>
    `${base}/applications/${encodeURIComponent(application)}/settings/${encodeURIComponent(environment)}`;
  return {
    list: (application: string) =>
      http.request(
        `${base}/applications/${encodeURIComponent(application)}/settings`,
        applicationDeploySettingsResponseSchema,
      ),
    set: (application: string, environment: string, body: SetDeploySettingsBody) =>
      http.request(pathOf(application, environment), applicationDeploySettingsSchema, {
        method: 'PUT',
        body,
      }),
    clear: (application: string, environment: string) =>
      http.send(pathOf(application, environment), { method: 'DELETE' }),
    followers: (environment: string) =>
      http.request(
        `${base}/environments/${encodeURIComponent(environment)}/runtimes`,
        environmentRuntimesResponseSchema,
      ),
  };
}
