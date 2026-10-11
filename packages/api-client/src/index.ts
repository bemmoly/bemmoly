/**
 * The typed client for /api/v1. Hand-written for 0.1.0 against the zod schemas
 * in @bemmoly/shared; it is generated from the OpenAPI document in a later
 * release, keeping these function names. Module endpoints live with their
 * module, so this package never depends on one.
 */
import { accessEndpoints } from './endpoints/access.ts';
import { aiEndpoints } from './endpoints/ai.ts';
import { appearanceEndpoints } from './endpoints/appearance.ts';
import { aiRunEndpoints } from './endpoints/ai-runs.ts';
import { aiPlanEndpoints } from './endpoints/ai-plans.ts';
import { codeHostEndpoints } from './endpoints/code-hosts.ts';
import { filesEndpoints } from './endpoints/files.ts';
import { importEndpoints } from './endpoints/imports.ts';
import { messagingEndpoints } from './endpoints/messaging.ts';
import { oauthEndpoints } from './endpoints/oauth.ts';
import { operationsEndpoints } from './endpoints/operations.ts';
import { peopleEndpoints } from './endpoints/people.ts';
import { authEndpoints, setupEndpoints } from './endpoints/session.ts';
import { settingsEndpoints } from './endpoints/settings.ts';
import { ssoEndpoints } from './endpoints/sso.ts';
import { webhookEndpoints } from './endpoints/webhooks.ts';
import { createHttp, type HttpOptions } from './http.ts';

export function createApiClient(options: HttpOptions = {}) {
  const http = createHttp(options);
  return {
    http,
    setup: setupEndpoints(http),
    auth: authEndpoints(http),
    settings: settingsEndpoints(http),
    appearance: appearanceEndpoints(http),
    imports: importEndpoints(http),
    codeHosts: codeHostEndpoints(http),
    sso: ssoEndpoints(http),
    oauth: oauthEndpoints(http),
    webhooks: webhookEndpoints(http),
    ai: {
      ...aiEndpoints(http),
      plans: aiPlanEndpoints(http),
      runs: aiRunEndpoints(http),
    },
    ...peopleEndpoints(http),
    ...accessEndpoints(http),
    ...messagingEndpoints(http),
    ...operationsEndpoints(http),
    ...filesEndpoints(http),
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
export { enc, validated } from './endpoints/validate.ts';
export { ssoStartPath } from './endpoints/sso.ts';
export type { AuditFilter, BackupsFilter } from './endpoints/operations.ts';
export type { ListOptions, UsersFilter } from './endpoints/people.ts';
export type { SettingRead } from './endpoints/settings.ts';
export type { UploadProgressOptions } from './xhr-upload.ts';
export { keysForEvent, queryKeys, type QueryKey } from './keys.ts';
