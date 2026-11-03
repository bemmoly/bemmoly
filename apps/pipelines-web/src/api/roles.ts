import type { Http } from '@bemmoly/api-client';
import { pipelinesMeSchema, ROLES_PATHS } from '@bemmoly/module-pipelines/shared';

/** Roles, people and approval groups (stream S1 fills these in). */
export const rolesKeys = {
  all: ['pipelines', 'roles'] as const,
  me: () => ['pipelines', 'roles', 'me'] as const,
  people: () => ['pipelines', 'roles', 'people'] as const,
  groups: () => ['pipelines', 'roles', 'groups'] as const,
};

export function rolesEndpoints(http: Http) {
  return {
    me: () => http.request(ROLES_PATHS.me, pipelinesMeSchema),
  };
}
