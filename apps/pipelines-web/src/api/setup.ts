import type { Http } from '@bemmoly/api-client';
import {
  PIPELINE_SETUP_PATHS,
  setupChecklistResponseSchema,
} from '@bemmoly/module-pipelines/shared';

/** The fresh-install setup checklist and connecting a cloud (stream S2 fills these in). */
export const setupKeys = {
  all: ['pipelines', 'setup'] as const,
  checklist: () => ['pipelines', 'setup', 'checklist'] as const,
};

export function setupEndpoints(http: Http) {
  return {
    checklist: () => http.request(PIPELINE_SETUP_PATHS.checklist, setupChecklistResponseSchema),
  };
}
