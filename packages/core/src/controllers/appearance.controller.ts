import {
  createCustomThemeSchema,
  customThemeParamsSchema,
  parseOrThrow,
  updateAppearancePreferenceSchema,
  updateCustomThemeSchema,
  type AppearancePreference,
  type CustomThemeRecord,
  type CustomThemesResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createCustomTheme,
  deleteCustomTheme,
  getAppearancePreference,
  listCustomThemes,
  setAppearancePreference,
  updateCustomTheme,
  type AppearanceDeps,
} from '../services/appearance/index.ts';
import { contextOf } from './request-context.ts';

/** /me/appearance and /themes: a person's own mode and theme, and custom themes. */
export function createAppearanceController(deps: AppearanceDeps) {
  const idOf = (request: FastifyRequest) =>
    parseOrThrow(customThemeParamsSchema, request.params).id;
  return {
    async preference(request: FastifyRequest): Promise<AppearancePreference> {
      return getAppearancePreference(deps, contextOf(request));
    },
    async setPreference(request: FastifyRequest): Promise<AppearancePreference> {
      const patch = parseOrThrow(updateAppearancePreferenceSchema, request.body);
      return setAppearancePreference(deps, contextOf(request), patch);
    },
    async list(request: FastifyRequest): Promise<CustomThemesResponse> {
      return { items: await listCustomThemes(deps, contextOf(request)) };
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<CustomThemeRecord> {
      const input = parseOrThrow(createCustomThemeSchema, request.body);
      const theme = await createCustomTheme(deps, contextOf(request), input);
      reply.code(201);
      return theme;
    },
    async update(request: FastifyRequest): Promise<CustomThemeRecord> {
      const input = parseOrThrow(updateCustomThemeSchema, request.body);
      return updateCustomTheme(deps, contextOf(request), idOf(request), input);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await deleteCustomTheme(deps, contextOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type AppearanceController = ReturnType<typeof createAppearanceController>;
