import {
  aiPreferencesBodySchema,
  aiStatusResponseSchema,
  type AiPreferencesBody,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { validated } from './validate.ts';

/**
 * The calls every signed-in person makes: their AI status and their own opt-out. The admin
 * API lives in `ai-admin.ts`, out of the shell's first load.
 */
export function aiEndpoints(http: Http) {
  return {
    status: async () => http.request('/api/v1/ai/status', aiStatusResponseSchema),
    setOptOut: async (optedOut: boolean) =>
      http.send('/api/v1/ai/preferences', {
        method: 'PUT',
        body: validated(aiPreferencesBodySchema, { optedOut }),
      }),
    /** The person's own preferences that follow them across devices, such as ghost text. */
    setPreferences: async (body: AiPreferencesBody) =>
      http.send('/api/v1/ai/preferences', {
        method: 'PUT',
        body: validated(aiPreferencesBodySchema, body),
      }),
  };
}
