import {
  aiCatalogUploadBodySchema,
  aiSettingsUpdateBodySchema,
  type AiCatalogStatus,
} from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import {
  CATALOG_POPULAR,
  catalogModels,
  catalogSummaries,
  catalogSummary,
} from '../seed/ai-catalog.ts';
import { invalid, notFound, ok, type MockRoute } from '../types.ts';
import { aiOf, changed, denied, parse } from './ai-state.ts';
import { docsState } from './docs-state.ts';
import { projectsOf } from './work-board-state.ts';

const ADMIN = '/api/v1/admin/ai';

function catalogStatus(db: MockDb): AiCatalogStatus {
  const ai = aiOf(db);
  const providers = catalogSummaries();
  const fetched = ai.catalogFetchedAt;
  const live = ai.settings.liveCatalog && fetched !== null;
  return {
    source: live ? 'live' : 'bundled',
    offline: !live,
    fetchedAt: fetched,
    bundledWith: live ? null : '0.5.0',
    line: live ? 'Live · models.dev' : 'Offline · bundled with 0.5.0',
    liveFetch: ai.settings.liveCatalog,
    providerCount: providers.length,
    modelCount: providers.reduce((sum, provider) => sum + provider.modelCount, 0),
  };
}

/** What Work and Docs register as excludable: their projects and spaces. */
function exclusionTargets(db: MockDb) {
  const projects = projectsOf(db).map((project) => ({
    kind: 'project' as const,
    id: String(project.id),
    name: String(project['name'] ?? ''),
    key: typeof project['key'] === 'string' ? project['key'] : null,
    moduleId: 'work',
  }));
  const spaces = docsState(db).spaces.map((space) => ({
    kind: 'space' as const,
    id: space.id,
    name: space.name,
    key: space.key,
    moduleId: 'docs',
  }));
  return [...projects, ...spaces];
}

export const aiAdminRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${ADMIN}/exclusion-targets`,
    handle: (_, db) => denied(db) ?? ok({ items: exclusionTargets(db) }),
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/settings`,
    handle: (_, db) => denied(db) ?? ok(aiOf(db).settings),
  },
  {
    method: 'PATCH',
    pattern: `${ADMIN}/settings`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const parsed = parse(aiSettingsUpdateBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      const settings = aiOf(db).settings;
      if (body.privacy) settings.privacy = { ...settings.privacy, ...body.privacy };
      if (body.budget) settings.budget = body.budget;
      if (body.liveCatalog !== undefined) settings.liveCatalog = body.liveCatalog;
      changed(db, 'ai.settings.updated');
      return ok(settings);
    },
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/catalog`,
    handle: (_, db) =>
      denied(db) ??
      ok({ status: catalogStatus(db), popular: CATALOG_POPULAR, providers: catalogSummaries() }),
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/catalog/providers/:id`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const summary = catalogSummary(request.params['id'] ?? '');
      if (!summary) return notFound('Provider');
      return ok({ provider: summary, models: catalogModels(summary.id) });
    },
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/catalog-snapshots`,
    handle: (request, db) => {
      const refused = denied(db);
      if (refused) return refused;
      const parsed = parse(aiCatalogUploadBodySchema, request);
      if (parsed.refused) return parsed.refused;
      const body = parsed.data;
      if (Object.keys(body.data).length === 0) {
        return invalid(
          'data',
          'This file lists no providers. Upload the api.json from models.dev.',
        );
      }
      aiOf(db).catalogFetchedAt = new Date().toISOString();
      changed(db, 'ai.catalog.uploaded');
      return ok({
        ...catalogStatus(db),
        source: 'uploaded',
        offline: true,
        line: 'Offline · uploaded just now',
      });
    },
  },
];
