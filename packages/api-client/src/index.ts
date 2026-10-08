/**
 * The typed client for /api/v1. Hand-written for 0.1.0 against the zod schemas
 * in @bemmoly/shared; it is generated from the OpenAPI document in a later
 * release, keeping these function names.
 */
import { accessEndpoints } from './endpoints/access.ts';
import { messagingEndpoints } from './endpoints/messaging.ts';
import { operationsEndpoints } from './endpoints/operations.ts';
import { peopleEndpoints } from './endpoints/people.ts';
import { authEndpoints, setupEndpoints } from './endpoints/session.ts';
import { settingsEndpoints } from './endpoints/settings.ts';
import { workBoardIssuesEndpoints } from './endpoints/work/board-issues.ts';
import { workBoardsEndpoints } from './endpoints/work/boards.ts';
import { workSettingsEndpoints } from './endpoints/work/settings.ts';
import { workWorkflowEndpoints } from './endpoints/work/workflows.ts';
import { createHttp, type HttpOptions } from './http.ts';

export function createApiClient(options: HttpOptions = {}) {
  const http = createHttp(options);
  return {
    http,
    setup: setupEndpoints(http),
    auth: authEndpoints(http),
    settings: settingsEndpoints(http),
    ...peopleEndpoints(http),
    ...accessEndpoints(http),
    ...messagingEndpoints(http),
    ...operationsEndpoints(http),
    /** Module endpoints, grouped by module so a workspace without Work never calls them. */
    work: {
      ...workBoardsEndpoints(http),
      ...workBoardIssuesEndpoints(http),
      ...workSettingsEndpoints(http),
      workflows: workWorkflowEndpoints(http),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export {
  ApiError,
  fieldErrors,
  hasErrorCode,
  isApiError,
  type ApiErrorCode,
  type ClientErrorCode,
} from './errors.ts';
export { buildQuery, createHttp, type Http, type HttpOptions, type Query } from './http.ts';
export type { AuditFilter, BackupsFilter } from './endpoints/operations.ts';
export type { ListOptions, UsersFilter } from './endpoints/people.ts';
export type { SettingRead } from './endpoints/settings.ts';
export { workSettingsKeys } from './endpoints/work/settings.ts';
export { workWorkflowKeys } from './endpoints/work/workflows.ts';
export { keysForEvent, queryKeys, type QueryKey } from './keys.ts';
