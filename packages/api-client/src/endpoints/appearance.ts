import {
  appearancePreferenceSchema,
  createCustomThemeSchema,
  customThemeSchema,
  customThemesResponseSchema,
  updateAppearancePreferenceSchema,
  updateCustomThemeSchema,
  workspaceLogoSchema,
  type CreateCustomThemeInput,
  type UpdateAppearancePreferenceInput,
  type UpdateCustomThemeInput,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** A person's own mode and theme, and the custom themes they can pick (ADR 0021). */
export function appearanceEndpoints(http: Http) {
  return {
    preference: async () => http.request('/api/v1/me/appearance', appearancePreferenceSchema),
    setPreference: async (body: UpdateAppearancePreferenceInput) =>
      http.request('/api/v1/me/appearance', appearancePreferenceSchema, {
        method: 'PUT',
        body: validated(updateAppearancePreferenceSchema, body),
      }),
    themes: {
      list: async () => http.request('/api/v1/themes', customThemesResponseSchema),
      create: async (body: CreateCustomThemeInput) =>
        http.request('/api/v1/themes', customThemeSchema, {
          method: 'POST',
          body: validated(createCustomThemeSchema, body),
        }),
      update: async (id: string, body: UpdateCustomThemeInput) =>
        http.request(`/api/v1/themes/${enc(id)}`, customThemeSchema, {
          method: 'PATCH',
          body: validated(updateCustomThemeSchema, body),
        }),
      remove: async (id: string) => http.send(`/api/v1/themes/${enc(id)}`, { method: 'DELETE' }),
    },
    /** The workspace's own logo: line one of the sidebar, the sign-in page and emails. */
    logo: {
      /** Sends one PNG, SVG or WebP; the answer's logoKey is where it is now served. */
      upload: async (file: Blob) =>
        http.upload('/api/v1/workspace/logo', workspaceLogoSchema, file),
      remove: async () => http.send('/api/v1/workspace/logo', { method: 'DELETE' }),
    },
  };
}
