import {
  aiCatalogProviderResponseSchema,
  aiCatalogResponseSchema,
  aiCatalogStatusSchema,
  aiCatalogUploadBodySchema,
  aiExclusionTargetsResponseSchema,
  aiModelRoleBodySchema,
  aiModelRolesResponseSchema,
  aiPromptDiffResponseSchema,
  aiPromptListResponseSchema,
  aiPromptOverrideBodySchema,
  aiPromptSchema,
  aiProviderCreateBodySchema,
  aiProviderDiscoverResponseSchema,
  aiProviderListResponseSchema,
  aiProviderSchema,
  aiProviderTestResponseSchema,
  aiProviderUpdateBodySchema,
  aiSettingsResponseSchema,
  aiSettingsUpdateBodySchema,
  aiUsageResponseSchema,
  type AiModelRoleBody,
  type AiProviderCreateBody,
  type AiProviderUpdateBody,
  type AiRole,
  type AiSettingsUpdateBody,
  type CatalogData,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const ADMIN = '/api/v1/admin/ai';

/**
 * The AI runtime's admin API: Settings › AI and the wizard's AI step, gated by
 * ai.models.configure. Its own entry (`@bemmoly/api-client/ai-admin`), bound to a client's
 * `http`, so its schemas load with those screens and stay out of the shell's first load.
 */
export function aiAdminEndpoints(http: Http) {
  return {
    settings: {
      get: async () => http.request(`${ADMIN}/settings`, aiSettingsResponseSchema),
      update: async (body: AiSettingsUpdateBody) =>
        http.request(`${ADMIN}/settings`, aiSettingsResponseSchema, {
          method: 'PATCH',
          body: validated(aiSettingsUpdateBodySchema, body),
        }),
    },
    /** The spaces and projects Privacy can exclude, from every module that registers some. */
    exclusionTargets: async () =>
      http.request(`${ADMIN}/exclusion-targets`, aiExclusionTargetsResponseSchema),
    catalog: {
      get: async () => http.request(`${ADMIN}/catalog`, aiCatalogResponseSchema),
      provider: async (id: string) =>
        http.request(`${ADMIN}/catalog/providers/${enc(id)}`, aiCatalogProviderResponseSchema),
      logoUrl: (id: string) => http.url(`${ADMIN}/catalog/logos/${enc(id)}`),
      /** An admin's models.dev api.json, read in the browser and sent as JSON. */
      upload: async (data: CatalogData) =>
        http.request(`${ADMIN}/catalog-snapshots`, aiCatalogStatusSchema, {
          method: 'POST',
          body: validated(aiCatalogUploadBodySchema, { data }),
        }),
    },
    providers: {
      list: async () => http.request(`${ADMIN}/providers`, aiProviderListResponseSchema),
      create: async (body: AiProviderCreateBody) =>
        http.request(`${ADMIN}/providers`, aiProviderSchema, {
          method: 'POST',
          body: validated(aiProviderCreateBodySchema, body),
          idempotent: true,
        }),
      update: async (id: string, body: AiProviderUpdateBody) =>
        http.request(`${ADMIN}/providers/${enc(id)}`, aiProviderSchema, {
          method: 'PATCH',
          body: validated(aiProviderUpdateBodySchema, body),
        }),
      remove: async (id: string) =>
        http.send(`${ADMIN}/providers/${enc(id)}`, { method: 'DELETE' }),
      test: async (id: string) =>
        http.request(`${ADMIN}/providers/${enc(id)}/test`, aiProviderTestResponseSchema, {
          method: 'POST',
        }),
      discover: async (id: string) =>
        http.request(`${ADMIN}/providers/${enc(id)}/discover`, aiProviderDiscoverResponseSchema, {
          method: 'POST',
        }),
      /** Tests values that are not saved yet; nothing is stored. */
      testDraft: async (body: AiProviderCreateBody) =>
        http.request(`${ADMIN}/provider-tests`, aiProviderTestResponseSchema, {
          method: 'POST',
          body: validated(aiProviderCreateBodySchema, body),
        }),
    },
    roles: {
      list: async () => http.request(`${ADMIN}/roles`, aiModelRolesResponseSchema),
      assign: async (role: AiRole, body: AiModelRoleBody) =>
        http.send(`${ADMIN}/roles/${enc(role)}`, {
          method: 'PUT',
          body: validated(aiModelRoleBodySchema, body),
        }),
      clear: async (role: AiRole) => http.send(`${ADMIN}/roles/${enc(role)}`, { method: 'DELETE' }),
    },
    usage: async (month?: string) =>
      http.request(`${ADMIN}/usage`, aiUsageResponseSchema, { query: { month } }),
    prompts: {
      list: async () => http.request(`${ADMIN}/prompts`, aiPromptListResponseSchema),
      override: async (id: string, template: string) =>
        http.request(`${ADMIN}/prompts/${enc(id)}/override`, aiPromptSchema, {
          method: 'PUT',
          body: validated(aiPromptOverrideBodySchema, { template }),
        }),
      reset: async (id: string) =>
        http.send(`${ADMIN}/prompts/${enc(id)}/override`, { method: 'DELETE' }),
      diff: async (id: string) =>
        http.request(`${ADMIN}/prompts/${enc(id)}/diff`, aiPromptDiffResponseSchema),
    },
  };
}
