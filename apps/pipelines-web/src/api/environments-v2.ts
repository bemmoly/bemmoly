import type { Http } from '@bemmoly/api-client';
import {
  approvalGroupsResponseSchema,
  appliedSuggestedSetupSchema,
  ROLES_PATHS,
  ENVIRONMENTS_V2_PATHS,
  environmentsV2ResponseSchema,
  environmentV2ViewSchema,
  type ApplySuggestedSetupBody,
  type CreateEnvironmentV2Input,
  type ReorderEnvironmentsBody,
  type UpdateEnvironmentV2Input,
} from '@bemmoly/module-pipelines/shared';

/** Equal environments on one ordered path, and the suggested setup. */
export const environmentsV2Keys = {
  all: ['pipelines', 'environments-v2'] as const,
  list: () => ['pipelines', 'environments-v2', 'list'] as const,
  groups: () => ['pipelines', 'environments-v2', 'groups'] as const,
};

export function environmentsV2Endpoints(http: Http) {
  return {
    list: () => http.request(ENVIRONMENTS_V2_PATHS.list, environmentsV2ResponseSchema),
    create: (body: CreateEnvironmentV2Input) =>
      http.request(ENVIRONMENTS_V2_PATHS.list, environmentV2ViewSchema, { method: 'POST', body }),
    update: (key: string, body: UpdateEnvironmentV2Input) =>
      http.request(ENVIRONMENTS_V2_PATHS.environment(key), environmentV2ViewSchema, {
        method: 'PATCH',
        body,
      }),
    remove: (key: string) =>
      http.send(ENVIRONMENTS_V2_PATHS.environment(key), { method: 'DELETE' }),
    reorder: (body: ReorderEnvironmentsBody) =>
      http.request(ENVIRONMENTS_V2_PATHS.order, environmentsV2ResponseSchema, {
        method: 'PUT',
        body,
      }),
    /** The approval groups a rule's steps choose from (People and roles makes them). */
    approvalGroups: () => http.request(ROLES_PATHS.groups, approvalGroupsResponseSchema),
    applySuggested: (body: ApplySuggestedSetupBody) =>
      http.request(ENVIRONMENTS_V2_PATHS.suggested, appliedSuggestedSetupSchema, {
        method: 'POST',
        body,
      }),
  };
}
