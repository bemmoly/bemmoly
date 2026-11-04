import type { Http } from '@bemmoly/api-client';
import {
  CLOUD_SETUP_PATHS,
  cloudAccessCheckResponseSchema,
  PIPELINE_SETUP_PATHS,
  setupChecklistResponseSchema,
  startOverResponseSchema,
  type CloudAccessCheckBody,
  type StartOverBody,
} from '@bemmoly/module-pipelines/shared';

/** The fresh-install setup checklist, checking cloud access, and Start over. */
export const setupKeys = {
  all: ['pipelines', 'setup'] as const,
  checklist: () => ['pipelines', 'setup', 'checklist'] as const,
  whoAmI: (signIn: string) => ['pipelines', 'setup', 'who-am-i', signIn] as const,
};

export function setupEndpoints(http: Http) {
  return {
    checklist: () => http.request(PIPELINE_SETUP_PATHS.checklist, setupChecklistResponseSchema),
    accessCheck: (body: CloudAccessCheckBody) =>
      http.request(CLOUD_SETUP_PATHS.accessCheck, cloudAccessCheckResponseSchema, {
        method: 'POST',
        body,
      }),
    startOver: (body: StartOverBody) =>
      http.request(PIPELINE_SETUP_PATHS.reset, startOverResponseSchema, { method: 'POST', body }),
  };
}
