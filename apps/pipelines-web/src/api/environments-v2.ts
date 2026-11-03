import type { Http } from '@bemmoly/api-client';
import {
  ENVIRONMENTS_V2_PATHS,
  environmentsV2ResponseSchema,
} from '@bemmoly/module-pipelines/shared';

/** Equal environments on one ordered path (stream S2 fills these in). */
export const environmentsV2Keys = {
  all: ['pipelines', 'environments-v2'] as const,
  list: () => ['pipelines', 'environments-v2', 'list'] as const,
};

export function environmentsV2Endpoints(http: Http) {
  return {
    list: () => http.request(ENVIRONMENTS_V2_PATHS.list, environmentsV2ResponseSchema),
  };
}
