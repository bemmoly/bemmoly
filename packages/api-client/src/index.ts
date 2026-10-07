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
export type { AuditFilter } from './endpoints/operations.ts';
export type { UsersFilter } from './endpoints/people.ts';
export type { SettingRead } from './endpoints/settings.ts';
export { keysForEvent, queryKeys, type QueryKey } from './keys.ts';
